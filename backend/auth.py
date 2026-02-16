from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from config import settings
from models import UserInDB
from database import get_database

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Verify a plain password against a hashed password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# Hash a password using bcrypt
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Create a JWT access token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):

    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

# Get the current user from the JWT token
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise credentials_exception
    return UserInDB(**user)

# Get the current customer user
async def get_current_customer(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "Customer":
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

# Get the current provider user
async def get_current_provider(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "Provider":
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user
