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
from datetime import datetime, timezone, date as date_type, timedelta
from services.availability_service import (
    normalize_slot_recurrence,
    slot_applies_to_date,
    slot_applies_to_service,
)
from services.datetime_utils import (
    format_schedule_date,
    parse_schedule_date,
    normalize_firestore_datetime,
)
from services.booking_reminder_service import build_booking_reminder_reset_fields
from services.notification_service import send_booking_rescheduled_notification

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


def get_provider_reschedule_context(
    db,
    booking_id: str,
    current_user: UserInDB,
) -> Dict[str, Any]:
    booking_doc = db.collection("client_records").document(booking_id).get()
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking_data = booking_doc.to_dict()

    service_doc = db.collection("services").document(booking_data["service_id"]).get()
    provider_docs = (
        db.collection("providers")
        .where("user_id", "==", current_user.id)
        .limit(1)
        .get()
    )

    if len(provider_docs) == 0:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_doc = provider_docs[0]
    provider_id = provider_doc.id
    provider_data = provider_doc.to_dict() or {}
    service_data = service_doc.to_dict() if service_doc.exists else None

    if not service_data or service_data["provider_id"] != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    availability_docs = (
        db.collection("availability")
        .where("provider_id", "==", provider_id)
        .limit(1)
        .get()
    )
    availability = availability_docs[0].to_dict() if availability_docs else None

    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]

    return {
        "booking_data": booking_data,
        "provider_id": provider_id,
        "provider_data": provider_data,
        "service_data": service_data,
        "availability": availability,
        "service_ids": service_ids,
    }


def get_bookings_for_service_ids(
    db,
    service_ids: List[str],
) -> List[Dict[str, Any]]:
    bookings = []

    if not service_ids:
        return bookings

    for i in range(0, len(service_ids), 10):
        batch_ids = service_ids[i:i + 10]
        bookings_docs = (
            db.collection("client_records")
            .where("service_id", "in", batch_ids)
            .get()
        )
        for doc in bookings_docs:
            bookings.append({"id": doc.id, "data": doc.to_dict()})

    return bookings


def build_available_slots_response(
    booking_id: str,
    booking_data: Dict[str, Any],
    availability: Dict[str, Any] | None,
    existing_bookings: List[Dict[str, Any]],
    target_date: datetime,
) -> Dict[str, Any]:
    day_of_week = target_date.weekday()

    if not availability:
        return {
            "date": format_schedule_date(target_date),
            "day_of_week": DAYS[day_of_week],
            "available_slots": [],
            "booked_slots": [],
            "message": "No availability schedule found",
        }

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
        return {
            "date": format_schedule_date(target_date),
            "day_of_week": DAYS[day_of_week],
            "available_slots": [],
            "booked_slots": [],
            "message": "No availability for this day",
        }

    booked_slots = [
        {
            "start_time": booking["data"]["start_time"],
            "end_time": booking["data"]["end_time"],
            "booking_id": booking["id"],
        }
        for booking in existing_bookings
        if booking["data"].get("status") in ["pending", "confirmed"]
    ]

    available_slots = []
    for slot in applicable_slots:
        session_duration = slot.get("session_duration", 30)
        sessions = generate_sessions(
            slot.get("start_time"),
            slot.get("end_time"),
            session_duration,
        )

        for session in sessions.get("sessions", []):
            is_booked = False
            for booked in booked_slots:
                if (
                    booked["start_time"] == session["start_time"]
                    and booked["end_time"] == session["end_time"]
                    and booked["booking_id"] != booking_id
                ):
                    is_booked = True
                    break

            if not is_booked:
                available_slots.append({
                    "start_time": session["start_time"],
                    "end_time": session["end_time"],
                    "session_duration": session_duration,
                })

    return {
        "date": format_schedule_date(target_date),
        "day_of_week": DAYS[day_of_week],
        "available_slots": available_slots,
        "booked_slots": booked_slots,
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
    today = date_type.today()
    
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
            "date": format_schedule_date(booking_data["date"]),
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
    db.collection("client_records").document(booking_id).update(
        {
            "status": "confirmed",
            **build_booking_reminder_reset_fields(),
        }
    )
    
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
            "date": format_schedule_date(booking_data["date"]),
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
    context = get_provider_reschedule_context(db, booking_id, current_user)
    booking_data = context["booking_data"]
    provider_id = context["provider_id"]
    provider_data = context.get("provider_data") or {}
    service_data = context.get("service_data") or {}
    
    # Parse the new date
    try:
        new_date = parse_schedule_date(reschedule_data.date)
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
    old_date = format_schedule_date(booking_data["date"])
    old_time = f"{booking_data['start_time']}-{booking_data['end_time']}"
    
    # Update the booking
    db.collection("client_records").document(booking_id).update({
        "date": new_date,
        "start_time": reschedule_data.start_time,
        "end_time": reschedule_data.end_time,
        **build_booking_reminder_reset_fields(),
    })

    customer_user_id = None
    customer_doc = db.collection("customers").document(booking_data["customer_id"]).get()
    if customer_doc.exists:
        customer_data = customer_doc.to_dict() or {}
        customer_user_id = customer_data.get("user_id")

    if customer_user_id:
        send_booking_rescheduled_notification(
            recipient_user_id=customer_user_id,
            provider_name=provider_data.get("provider_name", ""),
            service_name=service_data.get("name", ""),
            old_date=old_date,
            new_date=reschedule_data.date,
            old_time=old_time,
            new_time=f"{reschedule_data.start_time}-{reschedule_data.end_time}",
        )

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
    context = get_provider_reschedule_context(db, booking_id, current_user)
    booking_data = context["booking_data"]
    
    # Parse the date
    try:
        target_date = parse_schedule_date(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    existing_bookings = []
    for booking in get_bookings_for_service_ids(db, context["service_ids"]):
        booking_date = normalize_firestore_datetime(booking["data"].get("date"))
        if booking_date == target_date:
            existing_bookings.append(booking)

    return build_available_slots_response(
        booking_id=booking_id,
        booking_data=booking_data,
        availability=context["availability"],
        existing_bookings=existing_bookings,
        target_date=target_date,
    )


@router.get("/bookings/{booking_id}/available-slots-range", response_model=dict)
async def get_available_slots_range(
    booking_id: str,
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    context = get_provider_reschedule_context(db, booking_id, current_user)

    try:
        parsed_start_date = parse_schedule_date(start_date)
        parsed_end_date = parse_schedule_date(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if parsed_end_date < parsed_start_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date")

    all_bookings = get_bookings_for_service_ids(db, context["service_ids"])
    bookings_by_date: Dict[str, List[Dict[str, Any]]] = {}

    for booking in all_bookings:
        booking_data = booking["data"]
        booking_status = booking_data.get("status")
        if booking_status not in ["pending", "confirmed"]:
            continue

        booking_date = normalize_firestore_datetime(booking_data.get("date"))
        if not booking_date:
            continue
        if parsed_start_date <= booking_date <= parsed_end_date:
            date_key = format_schedule_date(booking_date)
            if date_key not in bookings_by_date:
                bookings_by_date[date_key] = []
            bookings_by_date[date_key].append(booking)

    responses = []
    current_date = parsed_start_date
    while current_date <= parsed_end_date:
        date_key = format_schedule_date(current_date)
        responses.append(
            build_available_slots_response(
                booking_id=booking_id,
                booking_data=context["booking_data"],
                availability=context["availability"],
                existing_bookings=bookings_by_date.get(date_key, []),
                target_date=current_date,
            )
        )
        current_date += timedelta(days=1)

    return {"dates": responses}

