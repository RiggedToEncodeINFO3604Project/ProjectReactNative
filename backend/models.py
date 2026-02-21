from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    CUSTOMER = "Customer"
    PROVIDER = "Provider"


class UserBase(BaseModel):
    email: EmailStr
    role: UserRole


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        populate_by_name = True


class UserInDB(User):
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: UserRole
    user_id: str


class CustomerBase(BaseModel):
    name: str
    phone: str


class CustomerCreate(CustomerBase):
    user_id: str


class Customer(CustomerBase):
    id: str = Field(alias="_id")
    user_id: str

    class Config:
        populate_by_name = True


class ProviderBase(BaseModel):
    provider_name: str
    business_name: str
    bio: str
    provider_address: str
    is_active: bool = True


class ProviderCreate(ProviderBase):
    user_id: str


class Provider(ProviderBase):
    id: str = Field(alias="_id")
    user_id: str

    class Config:
        populate_by_name = True


class TimeSlot(BaseModel):
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"
    session_duration: int = 30  # Duration in minutes, default 30


class DayAvailability(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    time_slots: List[TimeSlot]


class AvailabilitySchedule(BaseModel):
    provider_id: str
    schedule: List[DayAvailability]


class ServiceBase(BaseModel):
    name: str
    description: str
    price: float


class ServiceCreate(ServiceBase):
    provider_id: str


class Service(ServiceBase):
    id: str = Field(alias="_id")
    provider_id: str

    model_config = {"populate_by_name": True}


class ClientRecordBase(BaseModel):
    date: datetime
    cost: float
    customer_id: str
    service_id: str
    start_time: str
    end_time: str
    status: str = "pending"  # pending, confirmed, cancelled, completed


class ClientRecordCreate(ClientRecordBase):
    pass


class ClientRecord(ClientRecordBase):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True


class ProviderSearchResult(BaseModel):
    id: str
    provider_name: str
    business_name: str
    bio: str
    provider_address: str
    is_active: bool
    services: List[Service]


class BookingRequest(BaseModel):
    provider_id: str
    service_id: str
    date: str  # Format: "YYYY-MM-DD"
    start_time: str  # Format: "HH:MM"
    end_time: str  # Format: "HH:MM"


class DayBookingStatus(BaseModel):
    date: str
    status: str  # "available", "partially_booked", "mostly_booked", "fully_booked"
    available_percentage: float


class RescheduleRequest(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    start_time: str  # Format: "HH:MM"
    end_time: str  # Format: "HH:MM"
