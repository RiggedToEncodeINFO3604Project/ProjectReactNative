from pydantic import BaseModel, Field, EmailStr
from typing import Dict, Optional, List, Literal
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


AvailabilityRecurrence = Literal[
    "repeat_weekly",
    "just_today",
    "just_this_month",
    "specified_end_date",
]


class TimeSlot(BaseModel):
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"
    session_duration: int = 30  # Duration in minutes, default 30
    recurrence_type: AvailabilityRecurrence = "repeat_weekly"
    start_date: Optional[str] = None  # Format: "YYYY-MM-DD"
    end_date: Optional[str] = None  # Format: "YYYY-MM-DD"
    service_ids: List[str] = []  # Empty means all services


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


class BusyTime(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    start_time: str  # Format: "HH:MM"
    end_time: str  # Format: "HH:MM"


# ── Messaging ─────────────────────────────────────────────────────────

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
 
    
class MessageBase(BaseModel):
    sender_id: str
    sender_role: UserRole
    content: str
    message_type: MessageType = MessageType.TEXT
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class MessageCreate(MessageBase):
    conversation_id: str
    
    
class Message(MessageBase):
    id: str = Field(alias="_id")
    conversation_id: str
    created_at: datetime
    read: bool = False
    status: str = "sent"  # "sent", "delivered", "read"
    
    class Config:
        populate_by_name = True


# Last message preview stored in conversation (simplified Message object)
class LastMessage(BaseModel):
    id: str
    sender_id: str
    sender_role: UserRole
    content: str
    message_type: MessageType = MessageType.TEXT
    image_url: Optional[str] = None
    created_at: datetime
        
        
class ConversationBase(BaseModel):
    customer_id: str
    provider_id: str


class ConversationCreate(ConversationBase):
    pass


class Conversation(ConversationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    last_message: Optional[LastMessage] = None
    last_message_time: Optional[datetime] = None
    customer_unread_count: int = 0
    provider_unread_count: int = 0
    unread_count: int = 0  # Unified unread count for current user
    customer_name: Optional[str] = None
    provider_name: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    message_type: MessageType = MessageType.TEXT
    image_url: Optional[str] = None


class StartConversationRequest(BaseModel):
    recipient_id: str
    
    
# customer snapshot related models:
class CustomerNote(BaseModel):
    id: str = Field(alias="_id")
    customer_id: str
    provider_id: str
    note: str
    created_at: datetime # i see that we used strings for dates in most other stuff but this is just most convenient for me but i can adjust to whatever format we want later on
    updated_at: datetime

    class Config:
        populate_by_name = True


class CustomerTag(BaseModel):
    id: str = Field(alias="_id")
    customer_id: str
    provider_id: str
    tag: str
    color: Optional[str] = "#42bbeb"  # Light blue-ish by default
    created_at: datetime

    class Config:
        populate_by_name = True


class CustomerSnapshot(BaseModel):
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    total_visits: int
    last_service_date: Optional[str] # should be optional because it would be left blank if you tried to access a customer who just booked but didn't technically have a service done yet
    last_service_name: Optional[str] # same as above comment
    payment_preference: Optional[str] = "Not specified" # Could be left blank for people who don't really have a preference, or we don't have enough data to determine it
    tags: List[Dict[str, str]] = [] 
    notes: List[Dict[str, str]] = []
    total_spent: Optional[float] = 0.0 
