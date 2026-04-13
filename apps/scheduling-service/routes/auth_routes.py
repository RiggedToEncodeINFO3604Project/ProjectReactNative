from fastapi import APIRouter, Depends, HTTPException, status
import bcrypt
from pydantic import BaseModel, EmailStr, Field
from firebase_admin import auth as firebase_auth

from auth import get_current_user, resolve_user_from_claims, verify_firebase_token
from firebase_db import get_database
from models import Token, User
from services.datetime_utils import utc_now
from services.notification_service import remove_user_push_token, save_user_push_token
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


class PushTokenRequest(BaseModel):
    push_token: str = Field(..., min_length=1)


class LoginRequest(BaseModel):
    id_token: str = Field(..., min_length=1)


class LegacyLoginRequest(BaseModel):
    email: EmailStr
    password: str


class LegacyLoginResponse(BaseModel):
    custom_token: str
    role: str
    user_id: str


class FirebaseCustomTokenResponse(BaseModel):
    custom_token: str


def _build_user_document(email: str, role: str, firebase_uid: str) -> dict:
    return {
        "email": email,
        "role": role,
        "created_at": utc_now(),
        "last_login": None,
        "firebase_uid": firebase_uid,
        "auth_provider": "firebase",
    }


def _verify_legacy_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def _ensure_legacy_firebase_user(user_id: str, email: str, password: str) -> str:
    try:
        firebase_auth.get_user(user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        created_user = firebase_auth.create_user(
            uid=user_id,
            email=email,
            password=password,
        )
        return created_user.uid
    except Exception as exc:
        message = str(exc).lower()
        if "email already exists" in message or "uid already exists" in message:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to migrate account to Firebase authentication",
        ) from exc


# Register a new customer user
@router.post("/register/customer", response_model=dict)
async def register_customer(request: CustomerRegisterRequest):
    db = get_database()

    existing_users = db.collection("users").where("email", "==", request.email).limit(1).get()
    if len(existing_users) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")

    firebase_user = None

    try:
        firebase_user = firebase_auth.create_user(
            email=request.email,
            password=request.password,
        )
        user_id = firebase_user.uid
        customer_id = str(uuid.uuid4())

        batch = db.batch()
        batch.set(
            db.collection("users").document(user_id),
            _build_user_document(request.email, "Customer", user_id),
        )
        batch.set(
            db.collection("customers").document(customer_id),
            {
                "user_id": user_id,
                "name": request.name,
                "phone": request.phone,
            },
        )
        batch.commit()
    except Exception as exc:
        if firebase_user is not None:
            try:
                firebase_auth.delete_user(firebase_user.uid)
            except Exception:
                pass

        message = str(exc).lower()
        if "email already exists" in message:
            raise HTTPException(status_code=400, detail="Email already registered") from exc
        raise HTTPException(status_code=500, detail="Unable to register customer") from exc

    return {"message": "Customer registered successfully", "user_id": user_id}

# Register a new provider user
@router.post("/register/provider", response_model=dict)
async def register_provider(request: ProviderRegisterRequest):
    db = get_database()

    existing_users = db.collection("users").where("email", "==", request.email).limit(1).get()
    if len(existing_users) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")

    firebase_user = None

    try:
        firebase_user = firebase_auth.create_user(
            email=request.email,
            password=request.password,
        )
        user_id = firebase_user.uid
        provider_id = str(uuid.uuid4())

        batch = db.batch()
        batch.set(
            db.collection("users").document(user_id),
            _build_user_document(request.email, "Provider", user_id),
        )
        batch.set(
            db.collection("providers").document(provider_id),
            {
                "user_id": user_id,
                "provider_name": request.provider_name,
                "business_name": request.business_name,
                "bio": request.bio,
                "provider_address": request.provider_address,
                "is_active": request.is_active,
            },
        )
        batch.commit()
    except Exception as exc:
        if firebase_user is not None:
            try:
                firebase_auth.delete_user(firebase_user.uid)
            except Exception:
                pass

        message = str(exc).lower()
        if "email already exists" in message:
            raise HTTPException(status_code=400, detail="Email already registered") from exc
        raise HTTPException(status_code=500, detail="Unable to register provider") from exc

    return {"message": "Provider registered successfully", "user_id": user_id}


# Migrate a legacy Firestore password account into Firebase Auth on first login
@router.post("/login/legacy", response_model=LegacyLoginResponse)
async def login_legacy(request: LegacyLoginRequest):
    db = get_database()
    users = db.collection("users").where("email", "==", request.email).limit(1).get()

    if len(users) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_doc = users[0]
    user_data = user_doc.to_dict() or {}
    legacy_password = user_data.get("password")

    if not legacy_password or not _verify_legacy_password(request.password, legacy_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid = _ensure_legacy_firebase_user(
        user_doc.id,
        request.email,
        request.password,
    )

    db.collection("users").document(user_doc.id).set(
        {
            "last_login": utc_now(),
            "firebase_uid": firebase_uid,
            "auth_provider": "firebase",
        },
        merge=True,
    )

    custom_token = firebase_auth.create_custom_token(firebase_uid).decode("utf-8")
    return {
        "custom_token": custom_token,
        "role": user_data["role"],
        "user_id": user_doc.id,
    }


# Authenticate user and return Firebase ID token metadata
@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    db = get_database()
    claims = verify_firebase_token(request.id_token)
    current_user = resolve_user_from_claims(claims)

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No application profile found for this account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db.collection("users").document(current_user.id).set(
        {
            "last_login": utc_now(),
            "firebase_uid": claims.get("uid"),
            "auth_provider": "firebase",
        },
        merge=True,
    )

    return {
        "access_token": request.id_token,
        "token_type": "bearer",
        "role": current_user.role,
        "user_id": current_user.id,
    }


@router.post("/firebase/custom-token", response_model=FirebaseCustomTokenResponse)
async def create_firebase_custom_token(request: LoginRequest):
    claims = verify_firebase_token(request.id_token)
    current_user = resolve_user_from_claims(claims)

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No application profile found for this account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    custom_token = firebase_auth.create_custom_token(claims["uid"]).decode("utf-8")
    return {"custom_token": custom_token}


@router.post("/push-token", response_model=dict)
async def register_push_token(
    request: PushTokenRequest,
    current_user: User = Depends(get_current_user),
):
    save_user_push_token(current_user.id, request.push_token)
    return {"message": "Push token registered"}


@router.post("/push-token/remove", response_model=dict)
async def unregister_push_token(
    request: PushTokenRequest,
    current_user: User = Depends(get_current_user),
):
    remove_user_push_token(current_user.id, request.push_token)
    return {"message": "Push token removed"}
