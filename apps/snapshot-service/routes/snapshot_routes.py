import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from firebase_admin import firestore

from auth import get_current_provider
from firebase_db import get_database
from models import UserInDB
from services.datetime_utils import format_schedule_date
from services.tagging_service import (
    calculate_auto_tags,
    get_provider_tagging_config,
    resolve_tag_priority,
)

router = APIRouter(prefix="/provider", tags=["snapshot"])


def get_provider_context(db, current_user: UserInDB) -> tuple[str, dict]:
    provider_docs = (
        db.collection("providers").where("user_id", "==", current_user.id).limit(1).get()
    )
    if not provider_docs:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_doc = provider_docs[0]
    provider = provider_doc.to_dict()
    provider["_id"] = provider_doc.id
    return provider_doc.id, provider


def get_customer_bookings(db, customer_id: str, provider_id: str) -> list[dict]:
    services_docs = db.collection("services").where("provider_id", "==", provider_id).get()
    service_ids = [doc.id for doc in services_docs]

    if not service_ids:
        return []

    bookings_query = db.collection("client_records")
    bookings_query = bookings_query.where("customer_id", "==", customer_id)
    bookings_query = bookings_query.where("service_id", "in", service_ids)
    bookings_query = bookings_query.where("status", "in", ["confirmed", "completed"]).order_by(
        "date", direction=firestore.Query.DESCENDING
    )
    bookings_docs = bookings_query.get()
    return [booking.to_dict() for booking in bookings_docs]


@router.get("/customer/{customer_id}/snapshot", response_model=dict)
async def get_customer_snapshot(
    customer_id: str,
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, provider = get_provider_context(db, current_user)

    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer = customer_doc.to_dict()
    customer["_id"] = customer_doc.id

    customer_email = "Not available"
    user_id = customer.get("user_id")
    if user_id:
        user_doc = db.collection("users").document(user_id).get()
        if user_doc.exists:
            customer_email = (user_doc.to_dict() or {}).get("email", "Not available")

    bookings = get_customer_bookings(db, customer_id, provider_id)
    total_visits = len(bookings)
    total_spent = sum(booking.get("cost", 0) for booking in bookings)

    last_service_date = None
    last_service_name = None
    if bookings:
        latest_booking = bookings[0]
        last_service_date = format_schedule_date(latest_booking.get("date"))
        service_id = latest_booking.get("service_id")
        if service_id:
            service_doc = db.collection("services").document(service_id).get()
            if service_doc.exists:
                last_service_name = (service_doc.to_dict() or {}).get("name", "Unknown Service")

    tags_docs = (
        db.collection("customer_tags")
        .where("customer_id", "==", customer_id)
        .where("provider_id", "==", provider_id)
        .get()
    )
    tags = [
        {
            "id": tag.id,
            "tag": tag.to_dict().get("tag"),
            "color": tag.to_dict().get("color", "#f0c85a"),
        }
        for tag in tags_docs
    ]

    notes_query = (
        db.collection("customer_notes")
        .where("customer_id", "==", customer_id)
        .where("provider_id", "==", provider_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
    )
    notes = []
    try:
        notes_docs = notes_query.get()
        for note in notes_docs:
            note_data = note.to_dict()
            notes.append(
                {
                    "id": note.id,
                    "note": note_data.get("note"),
                    "created_at": note_data.get("created_at").isoformat()
                    if note_data.get("created_at")
                    else None,
                    "updated_at": note_data.get("updated_at").isoformat()
                    if note_data.get("updated_at")
                    else None,
                }
            )
    except Exception as exc:
        from google.api_core.exceptions import FailedPrecondition

        if not isinstance(exc, FailedPrecondition):
            raise

        fallback_docs = db.collection("customer_notes").where("customer_id", "==", customer_id).get()
        for note in fallback_docs:
            note_data = note.to_dict()
            if note_data.get("provider_id") != provider_id:
                continue
            notes.append(
                {
                    "id": note.id,
                    "note": note_data.get("note"),
                    "created_at": note_data.get("created_at").isoformat()
                    if note_data.get("created_at")
                    else None,
                    "updated_at": note_data.get("updated_at").isoformat()
                    if note_data.get("updated_at")
                    else None,
                }
            )
        notes.sort(key=lambda item: item.get("created_at") or "", reverse=True)

    config = get_provider_tagging_config(db, provider["_id"])
    try:
        auto_tags = calculate_auto_tags(db, provider["_id"], customer_id, bookings, config)
    except Exception:
        auto_tags = []

    merged_tags = resolve_tag_priority(tags, auto_tags, config.get("tag_priority", "manual_first"))
    for tag in merged_tags:
        if tag.get("weight") is None:
            tag["weight"] = 0
    merged_tags.sort(key=lambda tag: tag.get("weight", 0), reverse=True)

    return {
        "customer_id": customer_id,
        "customer_name": customer.get("name"),
        "customer_email": customer_email,
        "customer_phone": customer.get("phone"),
        "total_visits": total_visits,
        "last_service_date": last_service_date,
        "last_service_name": last_service_name,
        "payment_preference": "Not specified",
        "total_spent": total_spent,
        "tags": merged_tags,
        "auto_tags": auto_tags,
        "notes": notes,
    }


@router.get("/tags/rules", response_model=dict)
async def get_tagging_rules(current_user: UserInDB = Depends(get_current_provider)):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)
    return get_provider_tagging_config(db, provider_id)


@router.put("/tags/rules", response_model=dict)
async def update_tagging_rules(
    rules: dict,
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)
    existing_config = get_provider_tagging_config(db, provider_id)
    config = {**existing_config, **rules}
    db.collection("provider_tagging_rules").document(provider_id).set(config)
    return {"success": True, "config": config}


@router.post("/customer/{customer_id}/tags/auto-refresh", response_model=list)
async def refresh_customer_auto_tags(
    customer_id: str,
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, provider = get_provider_context(db, current_user)

    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    bookings = get_customer_bookings(db, customer_id, provider_id)
    config = get_provider_tagging_config(db, provider["_id"])
    return calculate_auto_tags(db, provider["_id"], customer_id, bookings, config)


@router.post("/customer/{customer_id}/tags", response_model=dict)
async def create_customer_tag(
    customer_id: str,
    tag_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)

    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    tag_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = tag_data.dict() if hasattr(tag_data, "dict") else (
        tag_data.model_dump() if hasattr(tag_data, "model_dump") else tag_data
    )
    db.collection("customer_tags").document(tag_id).set(
        {
            "customer_id": customer_id,
            "provider_id": provider_id,
            "tag": payload.get("tag", "Untitled"),
            "color": payload.get("color", "#42bbeb"),
            "created_at": now,
        }
    )

    return {
        "id": tag_id,
        "tag": payload.get("tag", "Untitled"),
        "color": payload.get("color", "#42bbeb"),
        "created_at": now.isoformat(),
    }


@router.put("/tags/{tag_id}", response_model=dict)
async def update_customer_tag(
    tag_id: str,
    tag_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)

    tag_doc = db.collection("customer_tags").document(tag_id).get()
    if not tag_doc.exists:
        raise HTTPException(status_code=404, detail="Tag not found")

    tag_obj = tag_doc.to_dict()
    if tag_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this tag")

    update_dict = {}
    if "tag" in tag_data:
        update_dict["tag"] = tag_data["tag"]
    if "color" in tag_data:
        update_dict["color"] = tag_data["color"]

    db.collection("customer_tags").document(tag_id).update(update_dict)
    return {
        "id": tag_id,
        "tag": update_dict.get("tag", tag_obj.get("tag")),
        "color": update_dict.get("color", tag_obj.get("color")),
        "message": "Tag updated successfully",
    }


@router.delete("/tags/{tag_id}", response_model=dict)
async def delete_customer_tag(
    tag_id: str,
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)

    tag_doc = db.collection("customer_tags").document(tag_id).get()
    if not tag_doc.exists:
        raise HTTPException(status_code=404, detail="Tag not found")

    tag_obj = tag_doc.to_dict()
    if tag_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this tag")

    db.collection("customer_tags").document(tag_id).delete()
    return {"message": "Tag deleted successfully", "tag_id": tag_id}


@router.post("/customer/{customer_id}/notes", response_model=dict)
async def create_customer_note(
    customer_id: str,
    note_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)

    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    note_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    db.collection("customer_notes").document(note_id).set(
        {
            "customer_id": customer_id,
            "provider_id": provider_id,
            "note": note_data.get("note", ""),
            "created_at": now,
            "updated_at": now,
        }
    )

    return {
        "id": note_id,
        "note": note_data.get("note", ""),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }


@router.put("/notes/{note_id}", response_model=dict)
async def update_customer_note(
    note_id: str,
    note_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)

    note_doc = db.collection("customer_notes").document(note_id).get()
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")

    note_obj = note_doc.to_dict()
    if note_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this note")

    now = datetime.now(timezone.utc)
    updated_note = note_data.get("note", note_obj.get("note"))
    db.collection("customer_notes").document(note_id).update(
        {
            "note": updated_note,
            "updated_at": now,
        }
    )

    return {
        "id": note_id,
        "note": updated_note,
        "updated_at": now.isoformat(),
        "message": "Note updated successfully",
    }


@router.delete("/notes/{note_id}", response_model=dict)
async def delete_customer_note(
    note_id: str,
    current_user: UserInDB = Depends(get_current_provider),
):
    db = get_database()
    provider_id, _ = get_provider_context(db, current_user)

    note_doc = db.collection("customer_notes").document(note_id).get()
    if not note_doc.exists:
        raise HTTPException(status_code=404, detail="Note not found")

    note_obj = note_doc.to_dict()
    if note_obj.get("provider_id") != provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")

    db.collection("customer_notes").document(note_id).delete()
    return {"message": "Note deleted successfully", "note_id": note_id}
