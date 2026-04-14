import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from google.cloud.firestore_v1.base_query import FieldFilter

from config import settings
from firebase_db import get_database
from services.datetime_utils import format_schedule_date, normalize_firestore_datetime, utc_now
from services.notification_service import send_booking_reminder_notification

REMINDER_DAY_BEFORE_SENT_AT_FIELD = "reminder_day_before_sent_at"
REMINDER_TWO_HOURS_SENT_AT_FIELD = "reminder_two_hours_sent_at"

log = logging.getLogger("skeduleit.booking_reminders")
FALLBACK_SCHEDULE_TIMEZONES = {
    "America/Port_of_Spain": timezone(timedelta(hours=-4), name="America/Port_of_Spain"),
}


def get_schedule_timezone() -> timezone | ZoneInfo:
    try:
        return ZoneInfo(settings.schedule_timezone)
    except ZoneInfoNotFoundError:
        fallback_timezone = FALLBACK_SCHEDULE_TIMEZONES.get(settings.schedule_timezone)
        if fallback_timezone is not None:
            log.info(
                "Using built-in fallback timezone for SCHEDULE_TIMEZONE '%s'",
                settings.schedule_timezone,
            )
            return fallback_timezone

        log.warning(
            "Invalid SCHEDULE_TIMEZONE '%s'; falling back to UTC",
            settings.schedule_timezone,
        )
        return timezone.utc


def build_booking_reminder_reset_fields() -> dict:
    return {
        REMINDER_DAY_BEFORE_SENT_AT_FIELD: None,
        REMINDER_TWO_HOURS_SENT_AT_FIELD: None,
    }


def build_booking_start_datetime(
    date_value: object,
    start_time: str,
    schedule_timezone: timezone | ZoneInfo,
) -> Optional[datetime]:
    booking_date = normalize_firestore_datetime(date_value)
    if not isinstance(booking_date, datetime):
        return None

    try:
        hours_text, minutes_text = start_time.split(":")[:2]
        hours = int(hours_text)
        minutes = int(minutes_text)
    except (TypeError, ValueError):
        return None

    return booking_date.replace(
        hour=hours,
        minute=minutes,
        second=0,
        microsecond=0,
        tzinfo=schedule_timezone,
    )


def _normalize_current_time(
    current_time: Optional[datetime],
    schedule_timezone: timezone | ZoneInfo,
) -> datetime:
    if current_time is None:
        return datetime.now(schedule_timezone)

    if current_time.tzinfo is None:
        return current_time.replace(tzinfo=schedule_timezone)

    return current_time.astimezone(schedule_timezone)


def _resolve_customer_user_id(db, customer_id: str, cache: dict[str, Optional[str]]) -> Optional[str]:
    if customer_id in cache:
        return cache[customer_id]

    customer_doc = db.collection("customers").document(customer_id).get()
    if not customer_doc.exists:
        cache[customer_id] = None
        return None

    customer_data = customer_doc.to_dict() or {}
    user_id = customer_data.get("user_id")
    cache[customer_id] = user_id if isinstance(user_id, str) and user_id else None
    return cache[customer_id]


def _resolve_service_context(
    db,
    service_id: str,
    service_cache: dict[str, tuple[str, Optional[str]]],
    provider_cache: dict[str, str],
) -> tuple[str, str]:
    cached = service_cache.get(service_id)
    if cached:
        service_name, provider_id = cached
    else:
        service_doc = db.collection("services").document(service_id).get()
        if not service_doc.exists:
            service_cache[service_id] = ("Your appointment", None)
            return ("Your appointment", "your provider")

        service_data = service_doc.to_dict() or {}
        service_name = service_data.get("name") or "Your appointment"
        provider_id = service_data.get("provider_id")
        service_cache[service_id] = (service_name, provider_id)

    provider_name = "your provider"
    if provider_id:
        cached_provider_name = provider_cache.get(provider_id)
        if cached_provider_name:
            provider_name = cached_provider_name
        else:
            provider_doc = db.collection("providers").document(provider_id).get()
            if provider_doc.exists:
                provider_data = provider_doc.to_dict() or {}
                provider_name = provider_data.get("provider_name") or "your provider"
            provider_cache[provider_id] = provider_name

    return service_name, provider_name


def process_due_booking_reminders(
    db=None,
    current_time: Optional[datetime] = None,
) -> dict:
    db = db or get_database()
    schedule_timezone = get_schedule_timezone()
    now = _normalize_current_time(current_time, schedule_timezone)

    bookings_docs = db.collection("client_records").where(
        filter=FieldFilter("status", "==", "confirmed")
    ).get()

    checked = 0
    notifications_sent = 0
    customer_cache: dict[str, Optional[str]] = {}
    service_cache: dict[str, tuple[str, Optional[str]]] = {}
    provider_cache: dict[str, str] = {}

    for booking_doc in bookings_docs:
        checked += 1
        booking_data = booking_doc.to_dict() or {}
        booking_start = build_booking_start_datetime(
            booking_data.get("date"),
            booking_data.get("start_time", ""),
            schedule_timezone,
        )
        if booking_start is None or booking_start <= now:
            continue

        day_before_trigger = booking_start - timedelta(days=1)
        two_hours_trigger = booking_start - timedelta(hours=2)
        reminder_kinds: list[tuple[str, str]] = []

        if (
            not booking_data.get(REMINDER_DAY_BEFORE_SENT_AT_FIELD)
            and day_before_trigger <= now < two_hours_trigger
        ):
            reminder_kinds.append(
                ("day_before", REMINDER_DAY_BEFORE_SENT_AT_FIELD)
            )

        if (
            not booking_data.get(REMINDER_TWO_HOURS_SENT_AT_FIELD)
            and two_hours_trigger <= now < booking_start
        ):
            reminder_kinds.append(
                ("two_hours_before", REMINDER_TWO_HOURS_SENT_AT_FIELD)
            )

        if not reminder_kinds:
            continue

        customer_id = booking_data.get("customer_id")
        service_id = booking_data.get("service_id")
        if not customer_id or not service_id:
            continue

        recipient_user_id = _resolve_customer_user_id(db, customer_id, customer_cache)
        if not recipient_user_id:
            continue

        service_name, provider_name = _resolve_service_context(
            db,
            service_id,
            service_cache,
            provider_cache,
        )

        date_label = format_schedule_date(booking_data.get("date")) or ""
        time_range = f"{booking_data.get('start_time', '')}-{booking_data.get('end_time', '')}"
        update_payload = {}

        for reminder_type, sent_field in reminder_kinds:
            sent = send_booking_reminder_notification(
                recipient_user_id=recipient_user_id,
                provider_name=provider_name,
                service_name=service_name,
                appointment_date=date_label,
                appointment_time=time_range,
                reminder_type=reminder_type,
            )
            if sent:
                update_payload[sent_field] = utc_now()
                notifications_sent += 1

        if update_payload:
            booking_doc.reference.update(update_payload)

    return {
        "checked": checked,
        "notifications_sent": notifications_sent,
    }


async def run_booking_reminder_worker(stop_event: asyncio.Event) -> None:
    poll_seconds = max(settings.reminder_worker_poll_seconds, 15)

    while not stop_event.is_set():
        try:
            result = await asyncio.to_thread(process_due_booking_reminders)
            if result["notifications_sent"] > 0:
                log.info(
                    "Sent %s booking reminder notification(s) after checking %s confirmed booking(s)",
                    result["notifications_sent"],
                    result["checked"],
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Booking reminder worker iteration failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_seconds)
        except asyncio.TimeoutError:
            continue
