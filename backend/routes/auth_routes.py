from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from models import UserCreate, User, Token, UserRole, CustomerCreate, Customer, ProviderCreate, Provider
from auth import get_password_hash, verify_password, create_access_token
from config import settings
from database import get_database
import uuid

router = APIRouter(prefix="/auth", tags=["authentication"])

# Register a new customer user
@router.post("/register/customer", response_model=dict)
async def register_customer(user_data: UserCreate, customer_data: CustomerCreate):
    db = get_database()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "_id": user_id,
        "email": user_data.email,
        "password": get_password_hash(user_data.password),
        "role": "Customer",
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    await db.users.insert_one(user_dict)
    
    # Create customer profile
    customer_dict = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": customer_data.name,
        "phone": customer_data.phone,
        "payment_type": customer_data.payment_type
    }
    await db.customers.insert_one(customer_dict)
    
    return {"message": "Customer registered successfully", "user_id": user_id}

# Register a new provider user
@router.post("/register/provider", response_model=dict)
async def register_provider(user_data: UserCreate, provider_data: ProviderCreate):
    db = get_database()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "_id": user_id,
        "email": user_data.email,
        "password": get_password_hash(user_data.password),
        "role": "Provider",
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    await db.users.insert_one(user_dict)
    
    # Create provider profile
    provider_dict = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "business_name": provider_data.business_name,
        "bio": provider_data.bio,
        "address": provider_data.address,
        "is_active": provider_data.is_active
    }
    await db.providers.insert_one(provider_dict)
    
    return {"message": "Provider registered successfully", "user_id": user_id}

# Authenticate user and return JWT token
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):

    db = get_database()
    user = await db.users.find_one({"email": form_data.username})
    
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Convert ObjectId to string for JWT
    user_id = str(user["_id"])
    
    # Update last login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user_id, "role": user["role"]}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "user_id": user_id
    }
