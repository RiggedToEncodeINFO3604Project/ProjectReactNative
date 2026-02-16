from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import (
    Service, ServiceCreate, AvailabilitySchedule, ClientRecord,
    UserInDB, DayAvailability
)
from auth import get_current_provider
from database import get_database
import uuid
from datetime import datetime

router = APIRouter(prefix="/provider", tags=["provider"])


@router.post("/services", response_model=Service)
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
    return Service(**service_dict)


@router.get("/services", response_model=List[Service])
# Get all services for the current provider
async def get_my_services(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    
    provider = await db.providers.find_one({"user_id": current_user.id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    services = await db.services.find({"provider_id": provider["_id"]}).to_list(100)
    return [Service(**service) for service in services]


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
    
    # Delete existing availability
    await db.availability.delete_many({"provider_id": provider["_id"]})
    
    # Insert new availability
    availability_dict = {
        "_id": str(uuid.uuid4()),
        "provider_id": provider["_id"],
        "schedule": [day.dict() for day in availability.schedule]
    }
    
    await db.availability.insert_one(availability_dict)
    return {"message": "Availability updated successfully"}


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
