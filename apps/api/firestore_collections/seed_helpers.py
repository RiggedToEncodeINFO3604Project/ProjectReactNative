"""Shared seed helpers for per-collection Firestore rebuild scripts."""

from __future__ import annotations

import uuid
import warnings
from datetime import datetime, timedelta, timezone

from firebase_admin import auth as firebase_auth

warnings.filterwarnings(
    "ignore",
    message="Detected filter using positional arguments",
)

TEST_CUSTOMER_EMAIL = "testc@test.com"
TEST_PROVIDER_EMAIL = "testp@test.com"
TEST_PASSWORD = "123456"

SERVICE_CATALOG = [
    {
        "name": "Test Service",
        "description": "A sample service for testing",
        "price": 50.0,
        "duration": 60,
    },
    {
        "name": "Haircut",
        "description": "Professional haircut service",
        "price": 35.0,
        "duration": 30,
    },
    {
        "name": "Hair Styling",
        "description": "Complete hair styling and treatment",
        "price": 55.0,
        "duration": 60,
    },
    {
        "name": "Beard Trim",
        "description": "Precise beard trimming and shaping",
        "price": 25.0,
        "duration": 30,
    },
]


def utc_now():
    return datetime.now(timezone.utc)


def stable_seed_datetime(days_ago: int) -> datetime:
    target_date = (utc_now() - timedelta(days=days_ago)).date()
    return datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        14,
        0,
        0,
        0,
        tzinfo=timezone.utc,
    )


def get_first(docs):
    for doc in docs:
        return doc
    return None


def ensure_firebase_user(email: str, password: str, preferred_uid: str | None = None):
    try:
        user = firebase_auth.get_user_by_email(email)
        firebase_auth.update_user(user.uid, password=password)
        return user, False
    except firebase_auth.UserNotFoundError:
        create_kwargs = {
            "email": email,
            "password": password,
        }
        if preferred_uid:
            create_kwargs["uid"] = preferred_uid

        user = firebase_auth.create_user(**create_kwargs)
        return user, True


def ensure_user_document(db, email: str, role: str, password: str):
    existing_user_doc = get_first(
        db.collection("users").where("email", "==", email).limit(1).get()
    )
    preferred_uid = existing_user_doc.id if existing_user_doc else None

    firebase_user, created_in_auth = ensure_firebase_user(
        email,
        password,
        preferred_uid=preferred_uid,
    )

    if existing_user_doc:
        app_user_id = existing_user_doc.id
        existing_data = existing_user_doc.to_dict() or {}
        created_at = existing_data.get("created_at") or utc_now()
    else:
        app_user_id = firebase_user.uid
        created_at = utc_now()

    db.collection("users").document(app_user_id).set(
        {
            "email": email,
            "role": role,
            "created_at": created_at,
            "last_login": None,
            "firebase_uid": firebase_user.uid,
            "auth_provider": "firebase",
        },
        merge=True,
    )

    return {
        "app_user_id": app_user_id,
        "firebase_uid": firebase_user.uid,
        "created_in_auth": created_in_auth,
        "existing_user_doc": existing_user_doc is not None,
    }


def get_user_doc_by_email(db, email: str):
    return get_first(db.collection("users").where("email", "==", email).limit(1).get())


def require_user_doc_by_email(db, email: str, role_label: str):
    user_doc = get_user_doc_by_email(db, email)
    if not user_doc:
        raise RuntimeError(
            f"{role_label} user document not found. Rebuild the users collection first."
        )
    return user_doc


def ensure_customer_profile(db, user_id: str):
    existing_profile = get_first(
        db.collection("customers").where("user_id", "==", user_id).limit(1).get()
    )
    payload = {
        "user_id": user_id,
        "name": "Test Customer",
        "phone": "1234567890",
    }
    if existing_profile:
        existing_profile.reference.set(payload, merge=True)
        return existing_profile.id, False

    customer_id = str(uuid.uuid4())
    db.collection("customers").document(customer_id).set(payload)
    return customer_id, True


def ensure_provider_profile(db, user_id: str):
    existing_profile = get_first(
        db.collection("providers").where("user_id", "==", user_id).limit(1).get()
    )
    profile_payload = {
        "user_id": user_id,
        "provider_name": "Test Provider",
        "business_name": "Test Business",
        "bio": "Test bio",
        "provider_address": "Test Address",
        "is_active": True,
    }

    if existing_profile:
        existing_profile.reference.set(profile_payload, merge=True)
        return existing_profile.id, False

    provider_id = str(uuid.uuid4())
    db.collection("providers").document(provider_id).set(profile_payload)
    return provider_id, True


def require_customer_context(db):
    user_doc = require_user_doc_by_email(db, TEST_CUSTOMER_EMAIL, "Customer")
    profile_doc = get_first(
        db.collection("customers").where("user_id", "==", user_doc.id).limit(1).get()
    )
    if not profile_doc:
        raise RuntimeError(
            "Customer profile not found. Rebuild the customers collection first."
        )

    return {
        "user_doc": user_doc,
        "user_id": user_doc.id,
        "user": user_doc.to_dict() or {},
        "profile_doc": profile_doc,
        "profile_id": profile_doc.id,
        "profile": profile_doc.to_dict() or {},
    }


def require_provider_context(db):
    user_doc = require_user_doc_by_email(db, TEST_PROVIDER_EMAIL, "Provider")
    profile_doc = get_first(
        db.collection("providers").where("user_id", "==", user_doc.id).limit(1).get()
    )
    if not profile_doc:
        raise RuntimeError(
            "Provider profile not found. Rebuild the providers collection first."
        )

    return {
        "user_doc": user_doc,
        "user_id": user_doc.id,
        "user": user_doc.to_dict() or {},
        "profile_doc": profile_doc,
        "profile_id": profile_doc.id,
        "profile": profile_doc.to_dict() or {},
    }


def ensure_service(
    db,
    provider_id: str,
    name: str,
    description: str,
    price: float,
    duration: int,
):
    existing_docs = (
        db.collection("services").where("provider_id", "==", provider_id).get()
    )
    for doc in existing_docs:
        data = doc.to_dict() or {}
        if (data.get("name") or "").strip().lower() == name.lower():
            doc.reference.set(
                {
                    "provider_id": provider_id,
                    "name": name,
                    "description": description,
                    "price": price,
                    "duration": duration,
                },
                merge=True,
            )
            return doc.id, False

    service_id = str(uuid.uuid4())
    db.collection("services").document(service_id).set(
        {
            "_id": service_id,
            "provider_id": provider_id,
            "name": name,
            "description": description,
            "price": price,
            "duration": duration,
            "created_at": utc_now(),
        }
    )
    return service_id, True


def get_provider_services_by_name(db, provider_id: str):
    services = {}
    for doc in db.collection("services").where("provider_id", "==", provider_id).get():
        data = doc.to_dict() or {}
        name = data.get("name")
        if not name:
            continue
        services[name] = {
            "id": doc.id,
            "price": data.get("price"),
            "duration": data.get("duration"),
            "data": data,
        }
    return services


def require_provider_services(db, provider_id: str, service_names: list[str]):
    services = get_provider_services_by_name(db, provider_id)
    missing = [name for name in service_names if name not in services]
    if missing:
        missing_list = ", ".join(missing)
        raise RuntimeError(
            f"Missing required services: {missing_list}. Rebuild the services collection first."
        )
    return services


def ensure_provider_tagging_rules(db, provider_id: str):
    rules_payload = {
        "enabled": True,
        "frequency_thresholds": {
            "returning": 2,
            "regular": 5,
            "loyal": 10,
        },
        "spending_thresholds": {
            "regular_spender": 100,
            "high_value": 300,
            "premium": 600,
        },
        "recency_thresholds": {
            "active_days": 30,
            "at_risk_days": 90,
        },
        "tag_priority": "manual_first",
        "tag_weighting_enabled": True,
    }

    existing_doc = db.collection("provider_tagging_rules").document(provider_id).get()
    db.collection("provider_tagging_rules").document(provider_id).set(
        rules_payload,
        merge=True,
    )
    return provider_id, not existing_doc.exists


def ensure_provider_availability(db, provider_id: str, service_ids: list[str]):
    availability_payload = {
        "provider_id": provider_id,
        "schedule": [
            {
                "day_of_week": 0,
                "time_slots": [
                    {
                        "start_time": "09:00",
                        "end_time": "17:00",
                        "session_duration": 30,
                        "recurrence_type": "repeat_weekly",
                        "service_ids": service_ids,
                    }
                ],
            },
            {
                "day_of_week": 2,
                "time_slots": [
                    {
                        "start_time": "10:00",
                        "end_time": "16:00",
                        "session_duration": 30,
                        "recurrence_type": "repeat_weekly",
                        "service_ids": service_ids,
                    }
                ],
            },
            {
                "day_of_week": 4,
                "time_slots": [
                    {
                        "start_time": "09:30",
                        "end_time": "15:30",
                        "session_duration": 30,
                        "recurrence_type": "repeat_weekly",
                        "service_ids": service_ids,
                    }
                ],
            },
        ],
    }

    existing_doc = get_first(
        db.collection("availability").where("provider_id", "==", provider_id).limit(1).get()
    )
    if existing_doc:
        existing_doc.reference.set(availability_payload, merge=True)
        return existing_doc.id, False

    availability_id = str(uuid.uuid4())
    db.collection("availability").document(availability_id).set(availability_payload)
    return availability_id, True


def ensure_provider_busy_time(db, provider_id: str):
    busy_date = (utc_now() + timedelta(days=3)).strftime("%Y-%m-%d")
    existing_doc = get_first(
        db.collection("provider_busy_times")
        .where("provider_id", "==", provider_id)
        .where("date", "==", busy_date)
        .where("start_time", "==", "13:00")
        .limit(1)
        .get()
    )
    payload = {
        "provider_id": provider_id,
        "date": busy_date,
        "start_time": "13:00",
        "end_time": "14:00",
    }

    if existing_doc:
        existing_doc.reference.set(payload, merge=True)
        return existing_doc.id, False

    busy_id = str(uuid.uuid4())
    db.collection("provider_busy_times").document(busy_id).set(payload)
    return busy_id, True


def create_booking_if_missing(
    db,
    customer_id: str,
    service_id: str,
    booking_date: datetime,
    start_time: str,
    end_time: str,
    cost: float,
):
    existing = (
        db.collection("client_records")
        .where("customer_id", "==", customer_id)
        .where("service_id", "==", service_id)
        .where("start_time", "==", start_time)
        .get()
    )
    for doc in existing:
        data = doc.to_dict() or {}
        existing_date = data.get("date")
        if (
            isinstance(existing_date, datetime)
            and existing_date.date() == booking_date.date()
        ):
            return doc.id, False

    booking_id = str(uuid.uuid4())
    db.collection("client_records").document(booking_id).set(
        {
            "_id": booking_id,
            "customer_id": customer_id,
            "service_id": service_id,
            "date": booking_date,
            "start_time": start_time,
            "end_time": end_time,
            "cost": cost,
            "status": "completed",
            "created_at": utc_now(),
        }
    )
    return booking_id, True


def create_tag_if_missing(db, customer_id: str, provider_id: str, tag: str, color: str):
    existing = (
        db.collection("customer_tags")
        .where("customer_id", "==", customer_id)
        .where("provider_id", "==", provider_id)
        .where("tag", "==", tag)
        .limit(1)
        .get()
    )
    if existing:
        return existing[0].id, False

    tag_id = str(uuid.uuid4())
    db.collection("customer_tags").document(tag_id).set(
        {
            "_id": tag_id,
            "customer_id": customer_id,
            "provider_id": provider_id,
            "tag": tag,
            "color": color,
            "created_at": utc_now(),
        }
    )
    return tag_id, True


def create_note_if_missing(db, customer_id: str, provider_id: str, note: str):
    existing = (
        db.collection("customer_notes")
        .where("customer_id", "==", customer_id)
        .where("provider_id", "==", provider_id)
        .where("note", "==", note)
        .limit(1)
        .get()
    )
    if existing:
        return existing[0].id, False

    note_id = str(uuid.uuid4())
    now = utc_now()
    db.collection("customer_notes").document(note_id).set(
        {
            "_id": note_id,
            "customer_id": customer_id,
            "provider_id": provider_id,
            "note": note,
            "created_at": now,
            "updated_at": now,
        }
    )
    return note_id, True


def ensure_conversation(
    db,
    customer_user_id: str,
    provider_user_id: str,
    customer_name: str,
    provider_name: str,
):
    existing_doc = get_first(
        db.collection("conversations")
        .where("customer_id", "==", customer_user_id)
        .where("provider_id", "==", provider_user_id)
        .limit(1)
        .get()
    )

    now = utc_now()
    payload = {
        "customer_id": customer_user_id,
        "provider_id": provider_user_id,
        "customer_name": customer_name,
        "provider_name": provider_name,
        "created_at": now,
        "updated_at": now,
        "last_message": None,
        "last_message_time": None,
        "customer_unread_count": 0,
        "provider_unread_count": 0,
    }

    if existing_doc:
        existing_doc.reference.set(payload, merge=True)
        return existing_doc.id, False

    conversation_id = str(uuid.uuid4())
    db.collection("conversations").document(conversation_id).set(payload)
    return conversation_id, True


def ensure_message(
    db,
    conversation_id: str,
    message_id: str,
    sender_id: str,
    sender_role: str,
    content: str,
    created_at: datetime,
):
    payload = {
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_role": sender_role,
        "content": content,
        "message_type": "text",
        "image_url": None,
        "thumbnail_url": None,
        "created_at": created_at,
        "read": sender_role == "Provider",
        "status": "read" if sender_role == "Provider" else "sent",
    }

    top_level_ref = db.collection("messages").document(message_id)
    nested_ref = (
        db.collection("conversations")
        .document(conversation_id)
        .collection("messages")
        .document(message_id)
    )

    top_exists = top_level_ref.get().exists
    top_level_ref.set(payload, merge=True)
    nested_ref.set(payload, merge=True)
    return not top_exists


def ensure_conversation_messages(
    db,
    conversation_id: str,
    customer_user_id: str,
    provider_user_id: str,
):
    seed_messages = [
        {
            "id": f"{conversation_id}-seed-1",
            "sender_id": customer_user_id,
            "sender_role": "Customer",
            "content": "Hi, I would like to book an appointment.",
            "created_at": utc_now() - timedelta(days=2, minutes=15),
        },
        {
            "id": f"{conversation_id}-seed-2",
            "sender_id": provider_user_id,
            "sender_role": "Provider",
            "content": "Sure, I have openings this week.",
            "created_at": utc_now() - timedelta(days=2, minutes=5),
        },
        {
            "id": f"{conversation_id}-seed-3",
            "sender_id": customer_user_id,
            "sender_role": "Customer",
            "content": "Friday afternoon works best for me.",
            "created_at": utc_now() - timedelta(days=2),
        },
    ]

    created_count = 0
    for seed_message in seed_messages:
        created = ensure_message(
            db,
            conversation_id=conversation_id,
            message_id=seed_message["id"],
            sender_id=seed_message["sender_id"],
            sender_role=seed_message["sender_role"],
            content=seed_message["content"],
            created_at=seed_message["created_at"],
        )
        if created:
            created_count += 1

    last_message = seed_messages[-1]
    db.collection("conversations").document(conversation_id).set(
        {
            "updated_at": last_message["created_at"],
            "last_message_time": last_message["created_at"],
            "last_message": {
                "id": last_message["id"],
                "sender_id": last_message["sender_id"],
                "sender_role": last_message["sender_role"],
                "content": last_message["content"],
                "message_type": "text",
                "image_url": None,
                "created_at": last_message["created_at"],
            },
            "customer_unread_count": 0,
            "provider_unread_count": 1,
        },
        merge=True,
    )
    return created_count
