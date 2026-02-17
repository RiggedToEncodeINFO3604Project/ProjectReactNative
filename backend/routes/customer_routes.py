from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from models import (
    ProviderSearchResult, Service, BookingRequest, ClientRecord,
    ClientRecordCreate, UserInDB, DayBookingStatus
)
from auth import get_current_customer
from database import get_database
import uuid
from datetime import datetime, timedelta

router = APIRouter(prefix="/customer", tags=["customer"])


def generate_sessions(start_time: str, end_time: str, session_duration: int) -> Dict[str, Any]:
    # Parse times
    start_parts = start_time.split(':')
    end_parts = end_time.split(':')
    
    start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
    end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])
    
    total_minutes = end_minutes - start_minutes
    
    # Calculate number of COMPLETE sessions that fit within the window
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


@router.get("/providers/search", response_model=List[ProviderSearchResult])
# Search for providers by name or ID
async def search_providers(
    name: Optional[str] = Query(None),
    provider_id: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    query = {"is_active": True}
    
    if provider_id:
        query["_id"] = provider_id
    elif name:
        query["provider_name"] = {"$regex": name, "$options": "i"}
    
    providers = await db.providers.find(query).to_list(100)
    
    result = []
    for provider in providers:
        services = await db.services.find({"provider_id": provider["_id"]}).to_list(100)
        result.append({
            "id": provider["_id"],
            "provider_name": provider["provider_name"],
            "business_name": provider["business_name"],
            "bio": provider["bio"],
            "provider_address": provider["provider_address"],
            "is_active": provider["is_active"],
            "services": [Service(**service) for service in services]
        })
    
    return result


@router.get("/providers/{provider_id}/availability/{date}", response_model=dict)
# Get available time slots for a provider on a specific date
async def get_provider_availability(
    provider_id: str,
    date: str,
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    # Parse date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    day_of_week = target_date.weekday()
    
    # Get provider availability
    availability = await db.availability.find_one({"provider_id": provider_id})
    if not availability:
        return {"available_slots": []}
    
    # Find the day's schedule
    day_schedule = None
    for day in availability["schedule"]:
        if day["day_of_week"] == day_of_week:
            day_schedule = day
            break
    
    if not day_schedule:
        return {"available_slots": []}
    
    # Get existing bookings for this date
    start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    services = await db.services.find({"provider_id": provider_id}).to_list(100)
    service_ids = [service["_id"] for service in services]
    
    bookings = await db.client_records.find({
        "service_id": {"$in": service_ids},
        "date": {"$gte": start_of_day, "$lt": end_of_day},
        "status": {"$in": ["pending", "confirmed"]}
    }).to_list(100)
    
    # Generate sessions from time slots
    all_sessions = []
    for slot in day_schedule["time_slots"]:
        session_duration = slot.get("session_duration", 30)  # Default 30 minutes
        result = generate_sessions(
            slot["start_time"],
            slot["end_time"],
            session_duration
        )
        all_sessions.extend(result["sessions"])
    
    # Filter out booked sessions
    available_slots = []
    for session in all_sessions:
        is_available = True
        for booking in bookings:
            # Check if this session overlaps with any booking
            if (booking["start_time"] < session["end_time"] and 
                booking["end_time"] > session["start_time"]):
                is_available = False
                break
        
        if is_available:
            available_slots.append(session)
    
    return {"available_slots": available_slots}


@router.get("/providers/{provider_id}/calendar/{year}/{month}", response_model=List[DayBookingStatus])
# Get booking status for each day in a month
async def get_provider_calendar(
    provider_id: str,
    year: int,
    month: int,
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    # Get provider availability
    availability = await db.availability.find_one({"provider_id": provider_id})
    
    # Get services
    services = await db.services.find({"provider_id": provider_id}).to_list(100)
    service_ids = [service["_id"] for service in services]
    
    # Calculate days in month
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    
    start_of_month = datetime(year, month, 1)
    
    # Get all bookings for the month
    bookings = await db.client_records.find({
        "service_id": {"$in": service_ids},
        "date": {"$gte": start_of_month, "$lt": next_month},
        "status": {"$in": ["pending", "confirmed"]}
    }).to_list(1000)
    
    # Group bookings by date
    bookings_by_date = {}
    for booking in bookings:
        date_str = booking["date"].strftime("%Y-%m-%d")
        if date_str not in bookings_by_date:
            bookings_by_date[date_str] = []
        bookings_by_date[date_str].append(booking)
    
    # Calculate status for each day
    result = []
    current_date = start_of_month
    
    while current_date < next_month:
        date_str = current_date.strftime("%Y-%m-%d")
        day_of_week = current_date.weekday()
        
        # Find day schedule
        day_schedule = None
        if availability:
            for day in availability["schedule"]:
                if day["day_of_week"] == day_of_week:
                    day_schedule = day
                    break
        
        if not availability or not day_schedule or not day_schedule["time_slots"]:
            status = "unavailable"
            available_percentage = 0.0
        else:
            # Calculate total available sessions
            total_sessions = 0
            for slot in day_schedule["time_slots"]:
                session_duration = slot.get("session_duration", 30)
                result_gen = generate_sessions(
                    slot["start_time"],
                    slot["end_time"],
                    session_duration
                )
                total_sessions += result_gen["sessions_created"]
            
            # Calculate booked sessions
            booked_sessions = 0
            if date_str in bookings_by_date:
                booked_sessions = len(bookings_by_date[date_str])
            
            if total_sessions == 0:
                available_percentage = 0.0
                status = "unavailable"
            else:
                booked_percentage = (booked_sessions / total_sessions) * 100
                available_percentage = 100 - booked_percentage
                
                if booked_percentage >= 100:
                    status = "fully_booked"
                elif booked_percentage >= 60:
                    status = "mostly_booked"
                elif booked_percentage > 0:
                    status = "partially_booked"
                else:
                    status = "available"
        
        result.append({
            "date": date_str,
            "status": status,
            "available_percentage": available_percentage
        })
        
        current_date += timedelta(days=1)
    
    return result


@router.post("/bookings", response_model=dict)
# Create a new booking request
async def create_booking(
    booking_request: BookingRequest,
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    # Get customer profile
    customer = await db.customers.find_one({"user_id": current_user.id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    # Verify service exists
    service = await db.services.find_one({"_id": booking_request.service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Parse date
    try:
        booking_date = datetime.strptime(booking_request.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if time slot is available
    day_of_week = booking_date.weekday()
    availability = await db.availability.find_one({"provider_id": booking_request.provider_id})
    
    if not availability:
        raise HTTPException(status_code=400, detail="Provider has no availability set")
    
    # Generate all valid sessions for this day and verify the requested time matches one
    is_valid_slot = False
    for day in availability["schedule"]:
        if day["day_of_week"] == day_of_week:
            for slot in day["time_slots"]:
                session_duration = slot.get("session_duration", 30)
                result = generate_sessions(
                    slot["start_time"],
                    slot["end_time"],
                    session_duration
                )
                # Check if the requested booking matches any generated session
                for session in result["sessions"]:
                    if (booking_request.start_time == session["start_time"] and 
                        booking_request.end_time == session["end_time"]):
                        is_valid_slot = True
                        break
                if is_valid_slot:
                    break
            if is_valid_slot:
                break
    
    if not is_valid_slot:
        raise HTTPException(status_code=400, detail="Requested time slot is not available. Please select a valid session time.")
    
    # Check for conflicts
    start_of_day = booking_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    conflicts = await db.client_records.find({
        "service_id": booking_request.service_id,
        "date": {"$gte": start_of_day, "$lt": end_of_day},
        "status": {"$in": ["pending", "confirmed"]},
        "$or": [
            {
                "start_time": {"$lt": booking_request.end_time},
                "end_time": {"$gt": booking_request.start_time}
            }
        ]
    }).to_list(10)
    
    if conflicts:
        raise HTTPException(status_code=400, detail="Time slot is already booked")
    
    # Create booking
    booking_dict = {
        "_id": str(uuid.uuid4()),
        "date": booking_date,
        "cost": service["price"],
        "customer_id": customer["_id"],
        "service_id": booking_request.service_id,
        "start_time": booking_request.start_time,
        "end_time": booking_request.end_time,
        "status": "pending"
    }
    
    await db.client_records.insert_one(booking_dict)
    
    return {
        "message": "Booking request created successfully",
        "booking_id": booking_dict["_id"]
    }


@router.get("/bookings", response_model=List[dict])
# Get all bookings for the current customer
async def get_my_bookings(current_user: UserInDB = Depends(get_current_customer)):
    db = get_database()
    
    customer = await db.customers.find_one({"user_id": current_user.id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    bookings = await db.client_records.find({"customer_id": customer["_id"]}).to_list(100)
    
    result = []
    for booking in bookings:
        service = await db.services.find_one({"_id": booking["service_id"]})
        provider = await db.providers.find_one({"_id": service["provider_id"]}) if service else None
        
        result.append({
            "booking_id": booking["_id"],
            "date": booking["date"].isoformat(),
            "start_time": booking["start_time"],
            "end_time": booking["end_time"],
            "cost": booking["cost"],
            "status": booking["status"],
            "service_name": service["name"] if service else "Unknown",
            "provider_name": provider["provider_name"] if provider else "Unknown"
        })
    
    return result

#Cancel booking
@router.delete("/bookings/{booking_id}", response_model=dict)
async def cancel_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    customer = await db.customers.find_one({"user_id": current_user.id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    booking = await db.client_records.find_one({
        "_id": booking_id,
        "customer_id": customer["_id"]
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.client_records.update_one(
        {"_id": booking_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Booking cancelled successfully"}
