from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from models import (
    ProviderSearchResult, Service, BookingRequest, ClientRecord,
    ClientRecordCreate, UserInDB, DayBookingStatus
)
from auth import get_current_customer
from firebase_db import get_database
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


@router.get("/providers/search")
# Search for providers by name or ID
async def search_providers(
    name: Optional[str] = Query(None),
    provider_id: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    result = []
    
    if provider_id:
        # Get specific provider by ID
        provider_doc = db.collection("providers").document(provider_id).get()
        if provider_doc.exists:
            provider_data = provider_doc.to_dict()
            if provider_data.get("is_active", True):
                # Get services for this provider
                services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
                formatted_services = []
                for service_doc in services_docs:
                    service_data = service_doc.to_dict()
                    formatted_service = {
                        "id": service_doc.id,
                        "provider_id": service_data["provider_id"],
                        "name": service_data["name"],
                        "description": service_data["description"],
                        "price": service_data["price"]
                    }
                    formatted_services.append(formatted_service)
                
                result.append({
                    "id": provider_doc.id,
                    "provider_name": provider_data["provider_name"],
                    "business_name": provider_data["business_name"],
                    "bio": provider_data["bio"],
                    "provider_address": provider_data["provider_address"],
                    "is_active": provider_data.get("is_active", True),
                    "services": formatted_services
                })
    else:
        # Get all active providers
        providers_docs = db.collection("providers").where("is_active", "==", True).get()
        
        for provider_doc in providers_docs:
            provider_data = provider_doc.to_dict()
            
            # Filter by name if provided (Firestore doesn't support regex)
            if name and name.lower() not in provider_data.get("provider_name", "").lower():
                continue
            
            # Get services for this provider
            services_docs = db.collection("services").where("provider_id", "==", provider_doc.id).get()
            formatted_services = []
            for service_doc in services_docs:
                service_data = service_doc.to_dict()
                formatted_service = {
                    "id": service_doc.id,
                    "provider_id": service_data["provider_id"],
                    "name": service_data["name"],
                    "description": service_data["description"],
                    "price": service_data["price"]
                }
                formatted_services.append(formatted_service)
            
            result.append({
                "id": provider_doc.id,
                "provider_name": provider_data["provider_name"],
                "business_name": provider_data["business_name"],
                "bio": provider_data["bio"],
                "provider_address": provider_data["provider_address"],
                "is_active": provider_data.get("is_active", True),
                "services": formatted_services
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
    availability_docs = db.collection("availability").where("provider_id", "==", provider_id).limit(1).get()
    if len(availability_docs) == 0:
        return {"available_slots": []}
    
    availability_doc = availability_docs[0]
    availability = availability_doc.to_dict()
    
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
    
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    # Get bookings for these services on this date
    bookings = []
    if service_ids:
        # Firestore "in" query supports max 10 values
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            bookings_docs = db.collection("client_records").where("service_id", "in", batch_ids).get()
            for doc in bookings_docs:
                booking_data = doc.to_dict()
                booking_date = booking_data["date"]
                # Filter by date range
                if start_of_day <= booking_date < end_of_day:
                    if booking_data["status"] in ["pending", "confirmed"]:
                        bookings.append(booking_data)
    
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
    availability_docs = db.collection("availability").where("provider_id", "==", provider_id).limit(1).get()
    availability = None
    if len(availability_docs) > 0:
        availability = availability_docs[0].to_dict()
    
    # Get services
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]
    
    # Calculate days in month
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    
    start_of_month = datetime(year, month, 1)
    
    # Get all bookings for the month
    bookings = []
    if service_ids:
        # Firestore "in" query supports max 10 values
        for i in range(0, len(service_ids), 10):
            batch_ids = service_ids[i:i+10]
            bookings_docs = db.collection("client_records").where("service_id", "in", batch_ids).get()
            for doc in bookings_docs:
                booking_data = doc.to_dict()
                booking_date = booking_data["date"]
                # Filter by date range
                if start_of_month <= booking_date < next_month:
                    if booking_data["status"] in ["pending", "confirmed"]:
                        bookings.append(booking_data)
    
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
    customer_docs = db.collection("customers").where("user_id", "==", current_user.id).limit(1).get()
    if len(customer_docs) == 0:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    customer_doc = customer_docs[0]
    customer_data = customer_doc.to_dict()
    customer_id = customer_doc.id
    
    # Verify service exists
    service_doc = db.collection("services").document(booking_request.service_id).get()
    if not service_doc.exists:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service_data = service_doc.to_dict()
    
    # Parse date
    try:
        booking_date = datetime.strptime(booking_request.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if time slot is available
    day_of_week = booking_date.weekday()
    availability_docs = db.collection("availability").where("provider_id", "==", booking_request.provider_id).limit(1).get()
    
    if len(availability_docs) == 0:
        raise HTTPException(status_code=400, detail="Provider has no availability set")
    
    availability = availability_docs[0].to_dict()
    
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
    
    # Get all bookings for this service on this date
    bookings_docs = db.collection("client_records").where("service_id", "==", booking_request.service_id).get()
    conflicts = []
    for doc in bookings_docs:
        booking_data = doc.to_dict()
        booking_data_date = booking_data["date"]
        # Filter by date
        if not (start_of_day <= booking_data_date < end_of_day):
            continue
        # Filter by status
        if booking_data["status"] not in ["pending", "confirmed"]:
            continue
        # Check time overlap
        if (booking_data["start_time"] < booking_request.end_time and
            booking_data["end_time"] > booking_request.start_time):
            conflicts.append(booking_data)
    
    if conflicts:
        raise HTTPException(status_code=400, detail="Time slot is already booked")
    
    # Create booking
    booking_id = str(uuid.uuid4())
    booking_dict = {
        "date": booking_date,
        "cost": service_data["price"],
        "customer_id": customer_id,
        "service_id": booking_request.service_id,
        "start_time": booking_request.start_time,
        "end_time": booking_request.end_time,
        "status": "pending"
    }
    
    db.collection("client_records").document(booking_id).set(booking_dict)
    
    return {
        "message": "Booking request created successfully",
        "booking_id": booking_id
    }


@router.get("/bookings", response_model=List[dict])
# Get all bookings for the current customer
async def get_my_bookings(current_user: UserInDB = Depends(get_current_customer)):
    db = get_database()
    
    customer_docs = db.collection("customers").where("user_id", "==", current_user.id).limit(1).get()
    if len(customer_docs) == 0:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    customer_doc = customer_docs[0]
    customer_id = customer_doc.id
    
    bookings_docs = db.collection("client_records").where("customer_id", "==", customer_id).get()
    
    result = []
    for booking_doc in bookings_docs:
        booking_data = booking_doc.to_dict()
        
        service_doc = db.collection("services").document(booking_data["service_id"]).get()
        service_data = service_doc.to_dict() if service_doc.exists else None
        
        provider_name = "Unknown"
        if service_data:
            provider_doc = db.collection("providers").document(service_data["provider_id"]).get()
            if provider_doc.exists:
                provider_data = provider_doc.to_dict()
                provider_name = provider_data.get("provider_name", "Unknown")
        
        result.append({
            "booking_id": booking_doc.id,
            "date": booking_data["date"].isoformat(),
            "start_time": booking_data["start_time"],
            "end_time": booking_data["end_time"],
            "cost": booking_data["cost"],
            "status": booking_data["status"],
            "service_name": service_data["name"] if service_data else "Unknown",
            "provider_name": provider_name
        })
    
    return result

#Cancel booking
@router.delete("/bookings/{booking_id}", response_model=dict)
async def cancel_booking(
    booking_id: str,
    current_user: UserInDB = Depends(get_current_customer)
):
    db = get_database()
    
    customer_docs = db.collection("customers").where("user_id", "==", current_user.id).limit(1).get()
    if len(customer_docs) == 0:
        raise HTTPException(status_code=404, detail="Customer profile not found")
    
    customer_doc = customer_docs[0]
    customer_id = customer_doc.id
    
    booking_doc = db.collection("client_records").document(booking_id).get()
    if not booking_doc.exists:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_data = booking_doc.to_dict()
    if booking_data["customer_id"] != customer_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    db.collection("client_records").document(booking_id).update({"status": "cancelled"})
    
    return {"message": "Booking cancelled successfully"}
