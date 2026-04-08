import json
import uuid
from typing import List
from urllib.parse import quote

from firebase_admin import storage as firebase_storage
from google.cloud import storage as google_cloud_storage

from config import settings


def _normalize_storage_bucket(value: str) -> str:
    trimmed = (value or "").strip()
    if not trimmed:
        return ""

    normalized = trimmed.replace("gs://", "")
    if "/" in normalized:
        normalized = normalized.split("/", 1)[0]
    return normalized.strip()


def _get_project_id() -> str:
    firebase_creds = settings.firebase_credentials.strip()
    if not firebase_creds:
        return ""

    try:
        return str(json.loads(firebase_creds).get("project_id", "")).strip()
    except json.JSONDecodeError:
        return ""


def get_storage_bucket_candidates() -> List[str]:
    candidates: List[str] = []
    seen = set()

    def add_candidate(value: str):
        normalized = _normalize_storage_bucket(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            candidates.append(normalized)

    add_candidate(settings.firebase_storage_bucket)

    project_id = _get_project_id()
    if project_id:
        add_candidate(f"{project_id}.appspot.com")
        add_candidate(f"{project_id}.firebasestorage.app")

    primary_bucket = candidates[0] if candidates else ""
    if primary_bucket.endswith(".firebasestorage.app"):
        add_candidate(primary_bucket.replace(".firebasestorage.app", ".appspot.com"))
    elif primary_bucket.endswith(".appspot.com"):
        add_candidate(primary_bucket.replace(".appspot.com", ".firebasestorage.app"))

    return candidates


def get_existing_storage_buckets() -> List[str]:
    firebase_creds = settings.firebase_credentials.strip()
    if not firebase_creds:
        return []

    try:
        cred_info = json.loads(firebase_creds)
        client = google_cloud_storage.Client.from_service_account_info(
            cred_info,
            project=cred_info.get("project_id"),
        )
        return [bucket.name for bucket in client.list_buckets()]
    except Exception:
        return []


def _sanitize_file_name(value: str) -> str:
    file_name = (value or "").strip() or f"message-image-{uuid.uuid4().hex}.jpg"
    return "".join(char if char.isalnum() or char in "._-" else "-" for char in file_name)


def _build_download_url(bucket_name: str, object_path: str, token: str) -> str:
    encoded_path = quote(object_path, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/"
        f"{encoded_path}?alt=media&token={token}"
    )


def upload_message_image(
    *,
    conversation_id: str,
    sender_id: str,
    file_bytes: bytes,
    file_name: str,
    content_type: str,
) -> str:
    if not file_bytes:
        raise ValueError("Image file is empty")

    bucket_candidates = get_storage_bucket_candidates()
    if not bucket_candidates:
        raise ValueError("Firebase Storage bucket is not configured")

    safe_file_name = _sanitize_file_name(file_name)
    object_path = (
        f"messages/{conversation_id}/{sender_id}/{uuid.uuid4().hex}-{safe_file_name}"
    )

    last_error: Exception | None = None

    for bucket_name in bucket_candidates:
        try:
            bucket = firebase_storage.bucket(name=bucket_name)
            blob = bucket.blob(object_path)
            download_token = str(uuid.uuid4())
            blob.metadata = {"firebaseStorageDownloadTokens": download_token}
            blob.upload_from_string(
                file_bytes,
                content_type=content_type or "image/jpeg",
            )
            blob.patch()
            return _build_download_url(bucket_name, object_path, download_token)
        except Exception as exc:
            last_error = exc

    existing_buckets = get_existing_storage_buckets()
    if not existing_buckets:
        raise RuntimeError(
            "No Firebase Storage bucket is available for this project. "
            "Create a bucket in Firebase Console > Storage and update "
            "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET."
        )

    raise RuntimeError(
        "Failed to upload image to Firebase Storage. "
        f"Configured/attempted buckets: {', '.join(bucket_candidates)}. "
        f"Available buckets: {', '.join(existing_buckets)}."
        + (f" Last error: {last_error}" if last_error else "")
    )
