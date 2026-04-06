from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import List, Dict, Any
from models import (
    Service, ServiceCreate, AvailabilitySchedule, ClientRecord,
    UserInDB, DayAvailability, RescheduleRequest, BusyTime
)
from auth import get_current_provider
from firebase_db import get_database
from firebase_admin import firestore
import uuid
from datetime import datetime, timezone, date as date_type
from services.availability_service import (
    normalize_slot_recurrence,
    slot_applies_to_date,
    slot_applies_to_service,
)
from services.tagging_service import calculate_auto_tags, get_provider_tagging_config, resolve_tag_priority

router = APIRouter(prefix="/provider", tags=["provider"])

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def generate_sessions(start_time: str, end_time: str, session_duration: int) -> Dict[str, Any]:
    # Parse times
    start_parts = start_time.split(':')
    end_parts = end_time.split(':')
    
    start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
    end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])
    
    total_minutes = end_minutes - start_minutes
    
    # Calculate number of COMPLETE sessions that fit within the window
    # A session at 9:30-10:15 would extend past 10:00, so we DON'T create it
    num_sessions = total_minutes // session_duration
    remainder_minutes = total_minutes % session_duration
    
    sessions = []
    current_time = start_minutes
    
    for i in range(num_sessions):
        session_start = current_time
        session_end = current_time + session_duration
        
        # Verify session fits entirely within the window
        if session_end <= end_minutes:
            sessions.append({
                'start_time': f'{session_start // 60:02d}:{session_start % 60:02d}',
                'end_time': f'{session_end // 60:02d}:{session_end % 60:02d}'
            })
        
        current_time = session_end
    
    return {
        'sessions': sessions,
        'remainder_minutes': remainder_minutes,
        'sessions_created': len(sessions)
    }


@router.post("/services")
# Add a new service for the provider
async def add_service(
    service: ServiceCreate,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    # Get provider profile
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    service_id = str(uuid.uuid4())
    service_dict = {
        "provider_id": provider_id,
        "name": service.name,
        "description": service.description,
        "price": service.price
    }
    
    db.collection("services").document(service_id).set(service_dict)
    # Return service with id field
    return {
        "id": service_id,
        "provider_id": service_dict["provider_id"],
        "name": service_dict["name"],
        "description": service_dict["description"],
        "price": service_dict["price"]
    }


@router.get("/services")
# Get all services for the current provider
async def get_my_services(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    # Return services with id field
    return [
        {
            "id": doc.id,
            "provider_id": doc.to_dict()["provider_id"],
            "name": doc.to_dict()["name"],
            "description": doc.to_dict()["description"],
            "price": doc.to_dict()["price"]
        }
        for doc in services_docs
    ]


@router.post("/availability", response_model=dict)
# Set availability schedule for the provider
async def set_availability(
    availability: AvailabilitySchedule,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    provider_service_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    provider_service_ids = {doc.id for doc in provider_service_docs}
    
    # Validate time slots and generate warnings for overflow
    warnings = []
    summary = {'total_slots_created': 0, 'total_remainder_minutes': 0}
    normalized_schedule = []
    today = datetime.now().date()
    
    for day in availability.schedule:
        normalized_day = {
            "day_of_week": day.day_of_week,
            "time_slots": []
        }
        for slot in day.time_slots:
            try:
                normalized_slot = normalize_slot_recurrence(
                    slot.dict(),
                    day.day_of_week,
                    today
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

            selected_service_ids = normalized_slot.get("service_ids") or []
            invalid_service_ids = [
                service_id
                for service_id in selected_service_ids
                if service_id not in provider_service_ids
            ]
            if invalid_service_ids:
                raise HTTPException(
                    status_code=400,
                    detail="Availability contains invalid service selections",
                )

            # Get session duration (default to 30 if not provided)
            session_duration = normalized_slot.get("session_duration") or 30
            
            # Generate sessions to check for overflow
            result = generate_sessions(
                normalized_slot["start_time"],
                normalized_slot["end_time"],
                session_duration
            )
            
            summary['total_slots_created'] += result['sessions_created']
            normalized_day["time_slots"].append(normalized_slot)
            
            # Check for remainder (overflow time that couldn't fit a full session)
            if result['remainder_minutes'] > 0:
                summary['total_remainder_minutes'] += result['remainder_minutes']
                
                # Calculate the unused time range
                start_parts = normalized_slot["start_time"].split(':')
                start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
                unused_start = start_minutes + (result['sessions_created'] * session_duration)
                unused_end = unused_start + result['remainder_minutes']
                
                unused_start_time = f'{unused_start // 60:02d}:{unused_start % 60:02d}'
                unused_end_time = f'{unused_end // 60:02d}:{unused_end % 60:02d}'
                
                warnings.append({
                    'day': DAYS[day.day_of_week],
                    'slot': f'{normalized_slot["start_time"]}-{normalized_slot["end_time"]}',
                    'session_duration': session_duration,
                    'remainder_minutes': result['remainder_minutes'],
                    'unused_time_range': f'{unused_start_time}-{unused_end_time}',
                    'sessions_created': result['sessions_created'],
                    'message': f'{result["remainder_minutes"]} minutes of remaining time ({unused_start_time}-{unused_end_time}) were insufficient for a full {session_duration}-minute session. Consider extending availability to {unused_end_time} or reducing session duration.',
                    'suggestions': [
                        f'Extend availability end time to {unused_end_time} to accommodate one more session',
                        f'Reduce session duration to fit more sessions in the available window'
                    ]
                })
        normalized_schedule.append(normalized_day)
    
    # Delete existing availability
    existing_availability = db.collection("availability").where("provider_id", "==", provider_id).get()
    batch = db.batch()
    for doc in existing_availability:
        batch.delete(doc.reference)
    batch.commit()
    
    # Insert new availability
    availability_id = str(uuid.uuid4())
    availability_dict = {
        "provider_id": provider_id,
        "schedule": normalized_schedule
    }
    
    db.collection("availability").document(availability_id).set(availability_dict)
    
    response = {
        "message": "Availability updated successfully",
        "summary": summary
    }
    
    if warnings:
        response["warnings"] = warnings
    
    return response


@router.get("/availability", response_model=dict)
# Get availability schedule for the current provider
async def get_availability(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    availability_docs = db.collection("availability").where("provider_id", "==", provider_id).limit(1).get()
    if len(availability_docs) == 0:
        return {"provider_id": provider_id, "schedule": []}
    
    availability_doc = availability_docs[0]
    availability_data = availability_doc.to_dict()
    
    return {
        "provider_id": availability_data["provider_id"],
        "schedule": availability_data["schedule"]
    }


@router.post("/calendar/busy-times", response_model=dict)
# Set busy times for the provider (overwrites existing ones)
async def set_busy_times(
    busy_times: List[BusyTime],
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    # Delete existing busy times for this provider
    existing_busy_times = db.collection("provider_busy_times").where("provider_id", "==", provider_id).get()
    batch = db.batch()
    for doc in existing_busy_times:
        batch.delete(doc.reference)
    batch.commit()
    
    # Add new busy times
    for busy_time in busy_times:
        busy_time_dict = {
            "provider_id": provider_id,
            "date": busy_time.date,
            "start_time": busy_time.start_time,
            "end_time": busy_time.end_time
        }
        db.collection("provider_busy_times").document().set(busy_time_dict)
    
    return {"message": "Busy times updated successfully"}


@router.get("/bookings/pending", response_model=List[dict])
# Get all pending bookings for the current provider
async def get_pending_bookings(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    # Get pending bookings
    bookings = []
    if service_ids:
        # Firestore "in" query supports max 10 values
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            bookings_docs = db.collection("client_records").where("service_id", "in", batch_ids).where("status", "==", "pending").get()
            for doc in bookings_docs:
                bookings.append({"id": doc.id, "data": doc.to_dict()})
    
    result = []
    for booking in bookings:
        booking_id = booking["id"]
        booking_data = booking["data"]
        
        customer_doc = db.collection("customers").document(booking_data["customer_id"]).get()
        customer_data = customer_doc.to_dict() if customer_doc.exists else None
        
        service_doc = db.collection("services").document(booking_data["service_id"]).get()
        service_data = service_doc.to_dict() if service_doc.exists else None
        
        result.append({
            "booking_id": booking_id,
            "date": booking_data["date"].isoformat(),
            "start_time": booking_data["start_time"],
            "end_time": booking_data["end_time"],
            "cost": booking_data["cost"],
            "customer_id": booking_data["customer_id"],
            "customer_name": customer_data["name"] if customer_data else "Unknown",
            "customer_phone": customer_data["phone"] if customer_data else "Unknown",
            "service_name": service_data["name"] if service_data else "Unknown",
            "status": booking_data["status"]
        })
    
    return result


@router.post("/bookings/{booking_id}/accept", response_model=dict)
# Accept a booking request
async def accept_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking_doc = db.collection("client_records").document(booking_id).get()
    
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_data = booking_doc.to_dict()
    
    service_doc = db.collection("services").document(booking_data["service_id"]).get()
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    service_data = service_doc.to_dict() if service_doc.exists else None
    
    if not service_data or service_data["provider_id"] != provider_doc.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Confirm the booking
    db.collection("client_records").document(booking_id).update({"status": "confirmed"})
    
    # Find and reject all other pending bookings that overlap with this time slot
    provider_id = provider_doc.id
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    if service_ids:
        # Firestore "in" query supports max 10 values
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            # Find pending bookings for the same date, time, and service
            overlapping_bookings = db.collection("client_records").where("service_id", "in", batch_ids).where("date", "==", booking_data["date"]).where("start_time", "==", booking_data["start_time"]).where("end_time", "==", booking_data["end_time"]).where("status", "==", "pending").get()
            
            batch = db.batch()
            for doc in overlapping_bookings:
                if doc.id != booking_id:  # Don't reject the one we just confirmed
                    batch.update(doc.reference, {"status": "cancelled"})
            batch.commit()
    
    return {"message": "Booking accepted"}


@router.post("/bookings/{booking_id}/reject", response_model=dict)
# Reject a booking request
async def reject_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking_doc = db.collection("client_records").document(booking_id).get()
    
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_data = booking_doc.to_dict()
    
    service_doc = db.collection("services").document(booking_data["service_id"]).get()
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    service_data = service_doc.to_dict() if service_doc.exists else None
    
    if not service_data or service_data["provider_id"] != provider_doc.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.collection("client_records").document(booking_id).update({"status": "cancelled"})
    
    return {"message": "Booking rejected"}


@router.get("/bookings/confirmed", response_model=List[dict])
# Get all confirmed bookings for the current provider
async def get_confirmed_bookings(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    # Get confirmed bookings
    bookings = []
    if service_ids:
        # Firestore "in" query supports max 10 values
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            bookings_docs = db.collection("client_records").where("service_id", "in", batch_ids).where("status", "==", "confirmed").get()
            for doc in bookings_docs:
                bookings.append({"id": doc.id, "data": doc.to_dict()})
    
    result = []
    for booking in bookings:
        booking_id = booking["id"]
        booking_data = booking["data"]
        
        customer_doc = db.collection("customers").document(booking_data["customer_id"]).get()
        customer_data = customer_doc.to_dict() if customer_doc.exists else None
        
        service_doc = db.collection("services").document(booking_data["service_id"]).get()
        service_data = service_doc.to_dict() if service_doc.exists else None
        
        result.append({
            "booking_id": booking_id,
            "date": booking_data["date"].isoformat(),
            "start_time": booking_data["start_time"],
            "end_time": booking_data["end_time"],
            "cost": booking_data["cost"],
            "customer_id": booking_data["customer_id"],
            "customer_name": customer_data["name"] if customer_data else "Unknown",
            "customer_phone": customer_data["phone"] if customer_data else "Unknown",
            "service_name": service_data["name"] if service_data else "Unknown",
            "status": booking_data["status"]
        })
    
    return result


@router.delete("/bookings/{booking_id}", response_model=dict)
# Delete a booking
async def delete_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking_doc = db.collection("client_records").document(booking_id).get()
    
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_data = booking_doc.to_dict()
    
    service_doc = db.collection("services").document(booking_data["service_id"]).get()
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    service_data = service_doc.to_dict() if service_doc.exists else None
    
    if not service_data or service_data["provider_id"] != provider_doc.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this booking")
    
    db.collection("client_records").document(booking_id).update({"status": "cancelled"})
    
    return {"message": "Booking cancelled successfully"}


@router.put("/bookings/{booking_id}/reschedule", response_model=dict)
# Reschedule a booking
async def reschedule_booking(
    booking_id: str,
    reschedule_data: RescheduleRequest,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking_doc = db.collection("client_records").document(booking_id).get()
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_data = booking_doc.to_dict()
    
    # Verify this booking belongs to this provider
    service_doc = db.collection("services").document(booking_data["service_id"]).get()
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    service_data = service_doc.to_dict() if service_doc.exists else None
    
    if not service_data or service_data["provider_id"] != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this booking")
    
    # Parse the new date
    try:
        new_date = datetime.strptime(reschedule_data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get the day of week for the new date (0=Monday, 6=Sunday)
    day_of_week = new_date.weekday()
    
    # Get provider's availability for this day
    availability_docs = db.collection("availability").where("provider_id", "==", provider_id).limit(1).get()
    if len(availability_docs) == 0:
        raise HTTPException(status_code=400, detail="No availability schedule found")
    
    availability = availability_docs[0].to_dict()
    
    applicable_slots = []
    for day in availability.get("schedule", []):
        if day.get("day_of_week") != day_of_week:
            continue
        applicable_slots = [
            slot for slot in day.get("time_slots", [])
            if slot_applies_to_date(slot, new_date.date())
            and slot_applies_to_service(slot, booking_data["service_id"])
        ]
        break

    if not applicable_slots:
        raise HTTPException(status_code=400, detail="No availability for the requested day")
    
    # Check if the requested time slot is within availability
    slot_available = False
    for slot in applicable_slots:
        session_duration = slot.get("session_duration", 30)
        result = generate_sessions(
            slot.get("start_time"),
            slot.get("end_time"),
            session_duration,
        )
        for session in result.get("sessions", []):
            if (
                session["start_time"] == reschedule_data.start_time
                and session["end_time"] == reschedule_data.end_time
            ):
                slot_available = True
                break
        if slot_available:
            break
    
    if not slot_available:
        raise HTTPException(status_code=400, detail="Requested time slot is outside availability window")
    
    # Get all provider's service IDs
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    # Check if the slot is already booked by another booking
    existing_booking = None
    if service_ids:
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            bookings_docs = db.collection("client_records").where("service_id", "in", batch_ids).where("date", "==", new_date).where("start_time", "==", reschedule_data.start_time).where("end_time", "==", reschedule_data.end_time).get()
            for doc in bookings_docs:
                if doc.id != booking_id:
                    booking_status = doc.to_dict().get("status")
                    if booking_status in ["pending", "confirmed"]:
                        existing_booking = doc
                        break
            if existing_booking:
                break
    
    if existing_booking:
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    
    # Store old values for response
    old_date = booking_data["date"].isoformat()
    old_time = f"{booking_data['start_time']}-{booking_data['end_time']}"
    
    # Update the booking
    db.collection("client_records").document(booking_id).update({
        "date": new_date,
        "start_time": reschedule_data.start_time,
        "end_time": reschedule_data.end_time
    })
    
    return {
        "message": "Booking rescheduled successfully",
        "booking_id": booking_id,
        "old_date": old_date,
        "new_date": reschedule_data.date,
        "old_time": old_time,
        "new_time": f"{reschedule_data.start_time}-{reschedule_data.end_time}"
    }


@router.get("/bookings/{booking_id}/available-slots", response_model=dict)
# Get available time slots for rescheduling a booking
async def get_available_slots(
    booking_id: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking_doc = db.collection("client_records").document(booking_id).get()
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_data = booking_doc.to_dict()
    
    # Verify this booking belongs to this provider
    service_doc = db.collection("services").document(booking_data["service_id"]).get()
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    
    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    service_data = service_doc.to_dict() if service_doc.exists else None
    
    if not service_data or service_data["provider_id"] != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Parse the date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get the day of week (0=Monday, 6=Sunday)
    day_of_week = target_date.weekday()
    
    # Get provider's availability for this day
    availability_docs = db.collection("availability").where("provider_id", "==", provider_id).limit(1).get()
    if len(availability_docs) == 0:
        return {"date": date, "day_of_week": DAYS[day_of_week], "available_slots": [], "booked_slots": [], "message": "No availability schedule found"}
    
    availability = availability_docs[0].to_dict()
    
    applicable_slots = []
    for day in availability.get("schedule", []):
        if day.get("day_of_week") != day_of_week:
            continue
        applicable_slots = [
            slot for slot in day.get("time_slots", [])
            if slot_applies_to_date(slot, target_date.date())
            and slot_applies_to_service(slot, booking_data["service_id"])
        ]
        break

    if not applicable_slots:
        return {"date": date, "day_of_week": DAYS[day_of_week], "available_slots": [], "booked_slots": [], "message": "No availability for this day"}
    
    # Get all provider's service IDs
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    # Get all bookings for this date (pending or confirmed)
    existing_bookings = []
    if service_ids:
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            bookings_docs = db.collection("client_records").where("service_id", "in", batch_ids).where("date", "==", target_date).get()
            for doc in bookings_docs:
                booking_status = doc.to_dict().get("status")
                if booking_status in ["pending", "confirmed"]:
                    existing_bookings.append({"id": doc.id, "data": doc.to_dict()})
    
    # Extract booked slots
    booked_slots = [
        {"start_time": b["data"]["start_time"], "end_time": b["data"]["end_time"], "booking_id": b["id"]}
        for b in existing_bookings
    ]
    
    # Generate available slots from availability schedule
    available_slots = []
    for slot in applicable_slots:
        session_duration = slot.get("session_duration", 30)
        start_time = slot.get("start_time")
        end_time = slot.get("end_time")
        
        # Generate sessions for this time slot
        sessions = generate_sessions(start_time, end_time, session_duration)
        
        for session in sessions.get("sessions", []):
            # Check if this session is already booked
            is_booked = False
            for booked in booked_slots:
                if (booked["start_time"] == session["start_time"] and 
                    booked["end_time"] == session["end_time"] and
                    booked["booking_id"] != booking_id):  # Exclude current booking
                    is_booked = True
                    break
            
            if not is_booked:
                available_slots.append({
                    "start_time": session["start_time"],
                    "end_time": session["end_time"],
                    "session_duration": session_duration
                })
    
    return {
        "date": date,
        "day_of_week": DAYS[day_of_week],
        "available_slots": available_slots,
        "booked_slots": booked_slots
    }


# customer snapshot - with integrated auto-tagging
@router.get("/customer/{customer_id}/snapshot", response_model=dict)
# snapshot view, will provide a quick list of information on a specific customer given that they have booked with you previously
# auto-tags are calculated and merged with manual tags by default
async def get_customer_snapshot(
    customer_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()

    # make sure provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_doc = provider_docs[0]
    provider = provider_doc.to_dict()
    provider["_id"] = provider_doc.id

    # get customer using their id
    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer = customer_doc.to_dict()
    customer["_id"] = customer_doc.id

    # get email from customer/user table
    user_id = customer.get("user_id")
    customer_email = "Not available"
    if user_id:
        user_doc = db.collection("users").document(user_id).get()
        if user_doc.exists:
            user = user_doc.to_dict()
            customer_email = user.get("email", "Not available")

    # get the services that the provider offers
    services_docs = db.collection("services").where("provider_id", "==", provider["_id"]).get()
    # services = [s.to_dict() for s in services_docs] # just incase i wanna use the dict version for whatever, i don't think it's really all that necessary
    service_ids = [doc.id for doc in services_docs]

    # get all prev bookings for this one customer
    # Firestore 'in' only supports like 10 items so empty service_ids have to be handled defensively
    bookings = []
    if service_ids:
        bookings_query = db.collection("client_records") # consider renaming to snapshot if we need to add more indexes to db
        bookings_query = bookings_query.where("customer_id", "==", customer_id)
        bookings_query = bookings_query.where("service_id", "in", service_ids)
        bookings_query = bookings_query.where("status", "in", ["confirmed", "completed"]).order_by("date", direction=firestore.Query.DESCENDING)
        bookings_docs = bookings_query.get()
        # convert to dicts and include id
        bookings = [b.to_dict() for b in bookings_docs]
    
    # calculate relevant snapshot data
    total_visits = len(bookings)
    total_spent = sum(booking.get("cost", 0) for booking in bookings) # might need to adjust - either test data is messed up or my brain doesn't work
    
    print(f"\n SNAPSHOT: {customer.get('name')} | Visits: {total_visits} | Spent: ${total_spent}") 
    
    last_service_date = None
    last_service_name = None
    if bookings:
        latest_booking = bookings[0]
        last_service_date = latest_booking.get("date").isoformat() if latest_booking.get("date") else None
        # get service by document id
        svc_id = latest_booking.get("service_id")
        last_service_name = "Unknown Service"
        if svc_id:
            svc_doc = db.collection("services").document(svc_id).get()
            if svc_doc.exists:
                svc = svc_doc.to_dict()
                last_service_name = svc.get("name", "Unknown Service")
        print(f"   Last Service: {last_service_name} on {last_service_date}")
    
    # grab tags
    tags_docs = db.collection("customer_tags").where("customer_id", "==", customer_id).where("provider_id", "==", provider["_id"]).get()
    tags = [
        {
            "id": t.id,
            "tag": t.to_dict().get("tag"),
            "color": t.to_dict().get("color", "#f0c85a")
        }
        for t in tags_docs
    ]
    print(f"   Tags: {len(tags)}")
    
    # grab notes - this and the tags should be specific to provider, should test later
    notes_query = db.collection("customer_notes").where("customer_id", "==", customer_id).where("provider_id", "==", provider["_id"]).order_by("created_at", direction=firestore.Query.DESCENDING)
    notes = []
    try:
        notes_docs = notes_query.get()
        for n in notes_docs:
            nd = n.to_dict()
            notes.append({
                "id": n.id,
                "note": nd.get("note"),
                "created_at": nd.get("created_at").isoformat() if nd.get("created_at") else None,
                "updated_at": nd.get("updated_at").isoformat() if nd.get("updated_at") else None,
            })
    except Exception as e:
        # I actually am not sure of this one, I asked AI if i did it correctly and it said that i might need a fallback incase firestore requires composite indexes but it was indexed anyways
        from google.api_core.exceptions import FailedPrecondition
        if isinstance(e, FailedPrecondition):
            # Fallback: query only by customer_id then filter provider_id in Python <-- This part was AI'd
            fallback_docs = db.collection("customer_notes").where("customer_id", "==", customer_id).get()
            for n in fallback_docs:
                nd = n.to_dict()
                    
                if nd.get("provider_id") != provider["_id"]:
                    continue

                notes.append({
                    "id": n.id,
                    "note": nd.get("note"),
                    "created_at": nd.get("created_at").isoformat() if nd.get("created_at") else None,
                    "updated_at": nd.get("updated_at").isoformat() if nd.get("updated_at") else None,
                })

            # sorts notes descending
            notes.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        else:
            raise
    print(f"   Total Notes: {len(notes)}\n")
    
    #  using placeholder for test purposes - revisit later
    payment_preference = "Not specified"
    # calculate auto-tags and merge
    config = get_provider_tagging_config(db, provider["_id"])
    try:
        auto_tags = calculate_auto_tags(db, provider["_id"], customer_id, bookings, config)
    except Exception:
        auto_tags = []

    # merge manual tags with auto-tags using priority rules
    priority_mode = config.get("tag_priority", "manual_first")
    merged_tags = resolve_tag_priority(tags, auto_tags, priority_mode)

    return {
        "customer_id": customer_id,
        "customer_name": customer.get("name"),
        "customer_email": customer_email,
        "customer_phone": customer.get("phone"),
        "total_visits": total_visits,
        "last_service_date": last_service_date,
        "last_service_name": last_service_name,
        "payment_preference": payment_preference,
        "total_spent": total_spent,
        "tags": merged_tags,
        "auto_tags": auto_tags,
        "notes": notes
    }


@router.get("/tags/rules", response_model=dict)
async def get_tagging_rules(current_user: UserInDB = Depends(get_current_provider)):
    # gets the current auto-tag thresholds for the provider accessing it
    db = get_database()

    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_doc = provider_docs[0]
    provider_id = provider_doc.id

    config = get_provider_tagging_config(db, provider_id)
    return config


@router.put("/tags/rules", response_model=dict)
async def update_tagging_rules(
    rules: dict,
    current_user: UserInDB = Depends(get_current_provider)
):
    """Update the auto-tagging thresholds for this provider.
    
    the format is like this - i know im gonna come back in a week and forget ~1/04/26 i did forget, good thing i wrote it out:
    {
        "frequency_thresholds": {"returning": 2, "regular": 5, "loyal": 10},
        "spending_thresholds": {"regular_spender": 100, "high_value": 500, "premium": 1000},
        "recency_thresholds": {"active_days": 30, "at_risk_days": 180},
        "enabled": true
    }
    """
    db = get_database()

    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_doc = provider_docs[0]
    provider_id = provider_doc.id

    # Merge with existing config to preserve unspecified fields
    existing_config = get_provider_tagging_config(db, provider_id)
    config = {**existing_config, **rules}

    db.collection("provider_tagging_rules").document(provider_id).set(config)

    return {"success": True, "config": config}


@router.post("/customer/{customer_id}/tags/auto-refresh", response_model=list)
async def refresh_customer_auto_tags(
    customer_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    # Recalc auto-tags for a given customer, manual tags aren't covered in this but im gonna return them for the sake of convenience - also i log everything and i feel like it'll clutter log if i don't
    db = get_database()

    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_doc = provider_docs[0]
    provider = provider_doc.to_dict()
    provider["_id"] = provider_doc.id

    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get provider services
    services_docs = db.collection("services").where("provider_id", "==", provider["_id"]).get()
    service_ids = [doc.id for doc in services_docs]

    bookings = []
    if service_ids:
        bookings_query = db.collection("client_records")
        bookings_query = bookings_query.where("customer_id", "==", customer_id)
        bookings_query = bookings_query.where("service_id", "in", service_ids)
        bookings_query = bookings_query.where("status", "in", ["confirmed", "completed"]).order_by("date", direction=firestore.Query.DESCENDING)
        bookings_docs = bookings_query.get()
        bookings = [b.to_dict() for b in bookings_docs]

    config = get_provider_tagging_config(db, provider["_id"])
    auto_tags = calculate_auto_tags(db, provider["_id"], customer_id, bookings, config)

    return auto_tags



# Tag Management
#----------------------------------------------------------------------
@router.post("/customer/{customer_id}/tags", response_model=dict)
async def create_customer_tag(
    customer_id: str,
    tag_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider)
):
    """Create a manual tag for a customer.
    
    Expected payload:
    {
        "tag": "Tag Name",
        "color": "#FF0000"
    }
    """
    db = get_database()
    
    # Verify that the provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    # Verify that the customer exists
    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    tag_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    # If its a pydantic model it should be converted to a dict
    tag_dict_data = tag_data.dict() if hasattr(tag_data, 'dict') else tag_data.model_dump() if hasattr(tag_data, 'model_dump') else tag_data
    tag_dict = {
        "customer_id": customer_id,
        "provider_id": provider_id,
        "tag": tag_dict_data.get("tag", "Untitled"),
        "color": tag_dict_data.get("color", "#42bbeb"),
        "created_at": now
    }
    
    db.collection("customer_tags").document(tag_id).set(tag_dict)
    
    return {
        "id": tag_id,
        "tag": tag_dict["tag"],
        "color": tag_dict["color"],
        "created_at": now.isoformat()
    }


@router.put("/tags/{tag_id}", response_model=dict)
async def update_customer_tag(
    tag_id: str,
    tag_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider)
):
    """Update an existing tag's text and/or color."""
    db = get_database()
    
    # Verify that the provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_id = provider_docs[0].id
    
    # Verify that the tag exists and belongs to this provider
    tag_doc = db.collection("customer_tags").document(tag_id).get()
    if not tag_doc.exists:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    tag_obj = tag_doc.to_dict()
    if tag_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this tag")
    
    update_dict = {}
    if "tag" in tag_data:
        update_dict["tag"] = tag_data["tag"]
    if "color" in tag_data:
        update_dict["color"] = tag_data["color"]
    
    db.collection("customer_tags").document(tag_id).update(update_dict)
    
    return {
        "id": tag_id,
        "tag": update_dict.get("tag", tag_obj.get("tag")),
        "color": update_dict.get("color", tag_obj.get("color")),
        "message": "Tag updated successfully"
    }


@router.delete("/tags/{tag_id}", response_model=dict)
async def delete_customer_tag(
    tag_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    """Delete a tag."""
    db = get_database()
    
    # Verify that the provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_id = provider_docs[0].id
    
    # Verify that the tag exists and belongs to this provider
    tag_doc = db.collection("customer_tags").document(tag_id).get()
    if not tag_doc.exists:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    tag_obj = tag_doc.to_dict()
    if tag_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this tag")
    
    db.collection("customer_tags").document(tag_id).delete()
    
    return {"message": "Tag deleted successfully", "tag_id": tag_id}


# Notes Management
#---------------------------------------------------------------------
@router.post("/customer/{customer_id}/notes", response_model=dict)
async def create_customer_note(
    customer_id: str,
    note_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider)
):
    """Create a new note for a customer.
    
    Expected payload:
    {
        "note": "Note content here"
    }
    """
    db = get_database()
    
    # Verify that the provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    
    # Verify that the customer exists
    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    note_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    note_dict = {
        "customer_id": customer_id,
        "provider_id": provider_id,
        "note": note_data.get("note", ""),
        "created_at": now,
        "updated_at": now
    }
    
    db.collection("customer_notes").document(note_id).set(note_dict)
    
    return {
        "id": note_id,
        "note": note_dict["note"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }


@router.put("/notes/{note_id}", response_model=dict)
async def update_customer_note(
    note_id: str,
    note_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider)
):
    """Update an existing note's content."""
    db = get_database()
    
    # Verify that the provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_id = provider_docs[0].id
    
    # Verify that the note exists and belongs to this provider
    note_doc = db.collection("customer_notes").document(note_id).get()
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note_obj = note_doc.to_dict()
    if note_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this note")
    
    now = datetime.now(timezone.utc)
    db.collection("customer_notes").document(note_id).update({
        "note": note_data.get("note", note_obj.get("note")),
        "updated_at": now
    })
    
    return {
        "id": note_id,
        "note": note_data.get("note", note_obj.get("note")),
        "updated_at": now.isoformat(),
        "message": "Note updated successfully"
    }


@router.delete("/notes/{note_id}", response_model=dict)
async def delete_customer_note(
    note_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    """Delete a note."""
    db = get_database()
    
    # Verify that the provider exists
    provider_docs = db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    if not provider_docs or len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider_id = provider_docs[0].id
    
    # Verify that thenote exists and belongs to this provider
    note_doc = db.collection("customer_notes").document(note_id).get()
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note_obj = note_doc.to_dict()
    if note_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")
    
    db.collection("customer_notes").document(note_id).delete()
    
    return {"message": "Note deleted successfully", "note_id": note_id}