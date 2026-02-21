from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any
from models import (
    Service, ServiceCreate, AvailabilitySchedule, ClientRecord,
    UserInDB, DayAvailability, RescheduleRequest
)
from auth import get_current_provider
from firebase_db import get_database
from firebase_admin import firestore
import uuid
from datetime import datetime, date as date_type

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
    
    # Validate time slots and generate warnings for overflow
    warnings = []
    summary = {'total_slots_created': 0, 'total_remainder_minutes': 0}
    
    for day in availability.schedule:
        for slot in day.time_slots:
            # Get session duration (default to 30 if not provided)
            session_duration = getattr(slot, 'session_duration', None) or 30
            
            # Generate sessions to check for overflow
            result = generate_sessions(
                slot.start_time,
                slot.end_time,
                session_duration
            )
            
            summary['total_slots_created'] += result['sessions_created']
            
            # Check for remainder (overflow time that couldn't fit a full session)
            if result['remainder_minutes'] > 0:
                summary['total_remainder_minutes'] += result['remainder_minutes']
                
                # Calculate the unused time range
                start_parts = slot.start_time.split(':')
                start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
                unused_start = start_minutes + (result['sessions_created'] * session_duration)
                unused_end = unused_start + result['remainder_minutes']
                
                unused_start_time = f'{unused_start // 60:02d}:{unused_start % 60:02d}'
                unused_end_time = f'{unused_end // 60:02d}:{unused_end % 60:02d}'
                
                warnings.append({
                    'day': DAYS[day.day_of_week],
                    'slot': f'{slot.start_time}-{slot.end_time}',
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
        "schedule": [day.dict() for day in availability.schedule]
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
    
    db.collection("client_records").document(booking_id).update({"status": "confirmed"})
    
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
    
    # Find the schedule for the requested day
    day_schedule = None
    for day in availability.get("schedule", []):
        if day.get("day_of_week") == day_of_week:
            day_schedule = day
            break
    
    if not day_schedule or not day_schedule.get("time_slots"):
        raise HTTPException(status_code=400, detail="No availability for the requested day")
    
    # Check if the requested time slot is within availability
    slot_available = False
    for slot in day_schedule.get("time_slots", []):
        if (slot.get("start_time") <= reschedule_data.start_time and 
            slot.get("end_time") >= reschedule_data.end_time):
            slot_available = True
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
    
    # Find the schedule for the requested day
    day_schedule = None
    for day in availability.get("schedule", []):
        if day.get("day_of_week") == day_of_week:
            day_schedule = day
            break
    
    if not day_schedule or not day_schedule.get("time_slots"):
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
    for slot in day_schedule.get("time_slots", []):
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
