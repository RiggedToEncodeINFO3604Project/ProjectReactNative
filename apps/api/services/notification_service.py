import json
import logging
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


def send_chat_push_notification(
    recipient_user_id: str,
    sender_name: str,
    conversation_id: str,
    recipient_role: str,
    message_preview: str,
    message_type: str = "text",
) -> None:
    push_tokens = get_user_push_tokens(recipient_user_id)
    if not push_tokens:
        return

    payload = {
        "to": push_tokens,
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
        return

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
