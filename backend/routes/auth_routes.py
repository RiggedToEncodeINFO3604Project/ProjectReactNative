from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from pydantic import BaseModel, EmailStr
from typing import Optional
from models import UserCreate, User, Token, UserRole, CustomerCreate, Customer, ProviderCreate, Provider
from auth import get_password_hash, verify_password, create_access_token
from config import settings
from firebase_db import get_database
import uuid

router = APIRouter(prefix="/auth", tags=["authentication"])


# Combined request models for registration
class CustomerRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "Customer"
    name: str
    phone: str
    user_id: str = ""


class ProviderRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "Provider"
    provider_name: str
    business_name: str
    bio: str
    provider_address: str
    is_active: bool = True
    user_id: str = ""


# Register a new customer user
@router.post("/register/customer", response_model=dict)
async def register_customer(request: CustomerRegisterRequest):
    db = get_database()
    
    # Check if user exists
    existing_users = db.collection("users").where("email", "==", request.email).limit(1).get()
    if len(existing_users) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "email": request.email,
        "password": get_password_hash(request.password),
        "role": "Customer",
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    db.collection("users").document(user_id).set(user_dict)
    
    # Create customer profile
    customer_id = str(uuid.uuid4())
    customer_dict = {
        "user_id": user_id,
        "name": request.name,
        "phone": request.phone
    }
    db.collection("customers").document(customer_id).set(customer_dict)
    
    return {"message": "Customer registered successfully", "user_id": user_id}

# Register a new provider user
@router.post("/register/provider", response_model=dict)
async def register_provider(request: ProviderRegisterRequest):
    db = get_database()
    
    # Check if user exists
    existing_users = db.collection("users").where("email", "==", request.email).limit(1).get()
    if len(existing_users) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "email": request.email,
        "password": get_password_hash(request.password),
        "role": "Provider",
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    db.collection("users").document(user_id).set(user_dict)
    
    # Create provider profile
    provider_id = str(uuid.uuid4())
    provider_dict = {
        "user_id": user_id,
        "provider_name": request.provider_name,
        "business_name": request.business_name,
        "bio": request.bio,
        "provider_address": request.provider_address,
        "is_active": request.is_active
    }
    db.collection("providers").document(provider_id).set(provider_dict)
    
    return {"message": "Provider registered successfully", "user_id": user_id}

# Authenticate user and return JWT token
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):

    db = get_database()
    users = db.collection("users").where("email", "==", form_data.username).limit(1).get()
    
    if len(users) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_doc = users[0]
    user_data = user_doc.to_dict()
    
    if not verify_password(form_data.password, user_data["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user ID from document ID
    user_id = user_doc.id
    
    # Update last login
    db.collection("users").document(user_id).update({"last_login": datetime.utcnow()})
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user_id, "role": user_data["role"]}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user_data["role"],
        "user_id": user_id
    }
