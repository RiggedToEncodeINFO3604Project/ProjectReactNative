from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from models import (
    Service, ServiceCreate, AvailabilitySchedule, ClientRecord,
    UserInDB, DayAvailability
)
from auth import get_current_provider
from database import get_database
import uuid
from datetime import datetime

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
    provider = await db.providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    service_dict = {
        "_id": str(uuid.uuid4()),
        "provider_id": provider["_id"],
        "name": service.name,
        "description": service.description,
        "price": service.price
    }
    
    await db.services.insert_one(service_dict)
    # Return service with id field (not _id)
    return {
        "id": service_dict["_id"],
        "provider_id": service_dict["provider_id"],
        "name": service_dict["name"],
        "description": service_dict["description"],
        "price": service_dict["price"]
    }


@router.get("/services")
# Get all services for the current provider
async def get_my_services(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider = await db.providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    services = await db.services.find({"provider_id": provider["_id"]}).to_list(100)
    # Return services with id field (not _id)
    return [
        {
            "id": service["_id"],
            "provider_id": service["provider_id"],
            "name": service["name"],
            "description": service["description"],
            "price": service["price"]
        }
        for service in services
    ]


@router.post("/availability", response_model=dict)
# Set availability schedule for the provider
async def set_availability(
    availability: AvailabilitySchedule,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    provider = await db.providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
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
    await db.availability.delete_many({"provider_id": provider["_id"]})
    
    # Insert new availability
    availability_dict = {
        "_id": str(uuid.uuid4()),
        "provider_id": provider["_id"],
        "schedule": [day.dict() for day in availability.schedule]
    }
    
    await db.availability.insert_one(availability_dict)
    
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
    
    provider = await db.providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    availability = await db.availability.find_one({"provider_id": provider["_id"]})
    if not availability:
        return {"provider_id": provider["_id"], "schedule": []}
    
    return {
        "provider_id": availability["provider_id"],
        "schedule": availability["schedule"]
    }


@router.get("/bookings/pending", response_model=List[dict])
# Get all pending bookings for the current provider
async def get_pending_bookings(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider = await db.providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    # Get services for this provider
    services = await db.services.find({"provider_id": provider["_id"]}).to_list(100)
    service_ids = [service["_id"] for service in services]
    
    # Get pending bookings
    bookings = await db.client_records.find({
        "service_id": {"$in": service_ids},
        "status": "pending"
    }).to_list(100)
    
    # Enrich with customer and service details
    result = []
    for booking in bookings:
        customer = await db.customers.find_one({"_id": booking["customer_id"]})
        service = await db.services.find_one({"_id": booking["service_id"]})
        
        result.append({
            "booking_id": booking["_id"],
            "date": booking["date"].isoformat(),
            "start_time": booking["start_time"],
            "end_time": booking["end_time"],
            "cost": booking["cost"],
            "customer_name": customer["name"] if customer else "Unknown",
            "customer_phone": customer["phone"] if customer else "Unknown",
            "service_name": service["name"] if service else "Unknown",
            "status": booking["status"]
        })
    
    return result


@router.post("/bookings/{booking_id}/accept", response_model=dict)
# Accept a booking request
async def accept_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking = await db.client_records.find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify this booking belongs to this provider
    service = await db.services.find_one({"_id": booking["service_id"]})
    provider = await db.providers.find_one({"user_id": current_user.id})
    
    if not service or service["provider_id"] != provider["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.client_records.update_one(
        {"_id": booking_id},
        {"$set": {"status": "confirmed"}}
    )
    
    return {"message": "Booking accepted"}


@router.post("/bookings/{booking_id}/reject", response_model=dict)
# Reject a booking request
async def reject_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_provider)
):
    db = get_database()
    
    booking = await db.client_records.find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify this booking belongs to this provider
    service = await db.services.find_one({"_id": booking["service_id"]})
    provider = await db.providers.find_one({"user_id": current_user.id})
    
    if not service or service["provider_id"] != provider["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.client_records.update_one(
        {"_id": booking_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Booking rejected"}
