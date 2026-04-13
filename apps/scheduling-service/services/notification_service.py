import json
import logging
from datetime import datetime
from typing import List
from urllib import request as urllib_request

from firebase_db import get_database

log = logging.getLogger("skedulelt.notifications")

EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"


def get_user_push_tokens(user_id: str) -> List[str]:
    user_doc = get_database().collection("users").document(user_id).get()
    if not user_doc.exists:
        return []

    user_data = user_doc.to_dict() or {}
    tokens = user_data.get("expo_push_tokens", [])
    if not isinstance(tokens, list):
        return []

    return [token for token in tokens if isinstance(token, str) and token.strip()]


def save_user_push_token(user_id: str, push_token: str) -> bool:
    normalized_token = push_token.strip()
    if not normalized_token:
        return False

    db = get_database()
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        return False

    existing_tokens = get_user_push_tokens(user_id)
    if normalized_token in existing_tokens:
        return True

    user_ref.update({"expo_push_tokens": existing_tokens + [normalized_token]})
    return True


def remove_user_push_token(user_id: str, push_token: str) -> bool:
    normalized_token = push_token.strip()
    if not normalized_token:
        return False

    db = get_database()
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        return False

    remaining_tokens = [
        token for token in get_user_push_tokens(user_id) if token != normalized_token
    ]
    user_ref.update({"expo_push_tokens": remaining_tokens})
    return True


def _build_message_body(message_preview: str, message_type: str) -> str:
    preview = (message_preview or "").strip()
    if message_type == "image":
        return "Sent you an image"
    if not preview:
        return "Sent you a message"
    return preview[:120]


def _send_push_payload(recipient_user_id: str, payload: dict) -> bool:
    push_tokens = get_user_push_tokens(recipient_user_id)
    if not push_tokens:
        return False

    payload = {
        **payload,
        "to": push_tokens,
    }

    req = urllib_request.Request(
        EXPO_PUSH_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=10) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        log.warning("Failed to send Expo push notification: %s", exc, exc_info=True)
        return False

    results = response_payload.get("data", [])
    invalid_tokens: List[str] = []

    for index, result in enumerate(results):
        if not isinstance(result, dict):
            continue

        details = result.get("details") or {}
        error = result.get("error")
        if error == "DeviceNotRegistered" or details.get("error") == "DeviceNotRegistered":
            if index < len(push_tokens):
                invalid_tokens.append(push_tokens[index])

    for invalid_token in invalid_tokens:
        remove_user_push_token(recipient_user_id, invalid_token)

    return True


def _format_schedule_date_label(date_value: str) -> str:
    try:
        return datetime.strptime(date_value, "%Y-%m-%d").strftime("%b %d, %Y")
    except ValueError:
        return date_value


def _format_schedule_time_label(time_value: str) -> str:
    try:
        hours_text, minutes_text = time_value.split(":")[:2]
        hours = int(hours_text)
        minutes = int(minutes_text)
    except (TypeError, ValueError):
        return time_value

    suffix = "AM" if hours < 12 else "PM"
    display_hours = hours % 12 or 12
    return f"{display_hours}:{minutes:02d} {suffix}"


def _format_schedule_time_range(range_value: str) -> str:
    try:
        start_time, end_time = range_value.split("-", 1)
    except ValueError:
        return range_value

    return f"{_format_schedule_time_label(start_time)}-{_format_schedule_time_label(end_time)}"


def send_chat_push_notification(
    recipient_user_id: str,
    sender_name: str,
    conversation_id: str,
    recipient_role: str,
    message_preview: str,
    message_type: str = "text",
) -> bool:
    return _send_push_payload(
        recipient_user_id,
        {
            "title": sender_name or "New message",
            "body": _build_message_body(message_preview, message_type),
            "sound": "default",
            "priority": "high",
            "channelId": "messages",
            "data": {
                "type": "chat_message",
                "conversationId": conversation_id,
                "recipientRole": recipient_role,
            },
        },
    )


def send_booking_rescheduled_notification(
    recipient_user_id: str,
    provider_name: str,
    service_name: str,
    old_date: str,
    new_date: str,
    old_time: str,
    new_time: str,
) -> bool:
    provider_label = provider_name or "your provider"
    service_label = service_name or "Your appointment"
    new_date_label = _format_schedule_date_label(new_date)
    new_time_label = _format_schedule_time_range(new_time)
    old_date_label = _format_schedule_date_label(old_date)
    old_time_label = _format_schedule_time_range(old_time)

    return _send_push_payload(
        recipient_user_id,
        {
            "title": "Appointment rescheduled",
            "body": (
                f"{service_label} with {provider_label} moved to "
                f"{new_date_label} at {new_time_label}."
            ),
            "sound": "default",
            "priority": "high",
            "channelId": "appointments",
            "data": {
                "type": "booking_rescheduled",
                "providerName": provider_label,
                "serviceName": service_label,
                "oldDate": old_date,
                "oldDateLabel": old_date_label,
                "newDate": new_date,
                "newDateLabel": new_date_label,
                "oldTime": old_time,
                "oldTimeLabel": old_time_label,
                "newTime": new_time,
                "newTimeLabel": new_time_label,
            },
        },
    )


def send_booking_reminder_notification(
    recipient_user_id: str,
    provider_name: str,
    service_name: str,
    appointment_date: str,
    appointment_time: str,
    reminder_type: str,
) -> bool:
    provider_label = provider_name or "your provider"
    service_label = service_name or "Your appointment"
    date_label = _format_schedule_date_label(appointment_date)
    time_label = _format_schedule_time_range(appointment_time)

    if reminder_type == "day_before":
        title = "Appointment tomorrow"
        body = (
            f"{service_label} with {provider_label} is tomorrow at {time_label}."
        )
    else:
        title = "Appointment in 2 hours"
        body = (
            f"{service_label} with {provider_label} starts in 2 hours at {time_label}."
        )

    return _send_push_payload(
        recipient_user_id,
        {
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "channelId": "appointments",
            "data": {
                "type": "booking_reminder",
                "providerName": provider_label,
                "serviceName": service_label,
                "appointmentDate": appointment_date,
                "appointmentDateLabel": date_label,
                "appointmentTime": appointment_time,
                "appointmentTimeLabel": time_label,
                "reminderType": reminder_type,
            },
        },
    )
