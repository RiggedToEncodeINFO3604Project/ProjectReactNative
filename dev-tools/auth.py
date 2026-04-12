from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import auth as firebase_auth

from firebase_db import get_database
from models import UserInDB

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def _credentials_exception(
    detail: str = "Could not validate credentials",
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_firebase_token(token: str) -> dict:
    try:
        return firebase_auth.verify_id_token(token)
    except Exception as exc:  # Firebase Admin raises multiple token error types
        raise _credentials_exception() from exc


def _link_legacy_user_document(user_doc, firebase_uid: str):
    user_data = user_doc.to_dict() or {}
    updates = {}

    if user_data.get("firebase_uid") != firebase_uid:
        updates["firebase_uid"] = firebase_uid
    if user_data.get("auth_provider") != "firebase":
        updates["auth_provider"] = "firebase"

    if updates:
        user_doc.reference.set(updates, merge=True)
        return user_doc.reference.get()

    return user_doc


def resolve_user_document(firebase_uid: str, email: Optional[str] = None):
    db = get_database()

    user_doc = db.collection("users").document(firebase_uid).get()
    if user_doc.exists:
        return _link_legacy_user_document(user_doc, firebase_uid)

    linked_users = (
        db.collection("users").where("firebase_uid", "==", firebase_uid).limit(1).get()
    )
    if linked_users:
        return _link_legacy_user_document(linked_users[0], firebase_uid)

    if email:
        legacy_users = db.collection("users").where("email", "==", email).limit(1).get()
        if legacy_users:
            return _link_legacy_user_document(legacy_users[0], firebase_uid)

    return None


def resolve_user_from_claims(claims: dict) -> Optional[UserInDB]:
    firebase_uid = claims.get("uid")
    email = claims.get("email")

    if not firebase_uid:
        return None

    user_doc = resolve_user_document(firebase_uid, email=email)
    if user_doc is None or not user_doc.exists:
        return None

    user_data = user_doc.to_dict() or {}
    user_data["id"] = user_doc.id
    user_data.setdefault("firebase_uid", firebase_uid)
    user_data.setdefault("auth_provider", "firebase")
    return UserInDB(**user_data)


def resolve_user_from_token(token: str) -> UserInDB:
    claims = verify_firebase_token(token)
    current_user = resolve_user_from_claims(claims)
    if current_user is None:
        raise _credentials_exception("No application profile found for this account")
    return current_user


async def get_current_user(token: str = Depends(oauth2_scheme)):
    return resolve_user_from_token(token)


async def get_current_firebase_identity(token: str = Depends(oauth2_scheme)):
    return verify_firebase_token(token)


async def get_current_customer(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "Customer":
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user


async def get_current_provider(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "Provider":
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user
