from calendar import monthrange
from datetime import date as date_type, timedelta
from typing import Any, Dict, Optional


def parse_iso_date(value: Optional[str]) -> Optional[date_type]:
    if not value:
        return None

    try:
        return date_type.fromisoformat(value)
    except ValueError:
        return None


def format_iso_date(value: date_type) -> str:
    return value.isoformat()


def end_of_week(value: date_type) -> date_type:
    return value + timedelta(days=(6 - value.weekday()))


def end_of_month(value: date_type) -> date_type:
    last_day = monthrange(value.year, value.month)[1]
    return value.replace(day=last_day)


def next_occurrence_for_weekday(
    reference_date: date_type,
    day_of_week: int,
) -> date_type:
    days_ahead = day_of_week - reference_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return reference_date + timedelta(days=days_ahead)


def normalize_slot_recurrence(
    slot: Dict[str, Any],
    day_of_week: int,
    reference_date: date_type,
) -> Dict[str, Any]:
    normalized = dict(slot)
    recurrence_type = normalized.get("recurrence_type") or "repeat_weekly"
    if recurrence_type == "just_this_week":
        recurrence_type = "just_today"
    normalized["recurrence_type"] = recurrence_type
    normalized["service_ids"] = list(normalized.get("service_ids") or [])

    start_date = parse_iso_date(normalized.get("start_date"))
    end_date = parse_iso_date(normalized.get("end_date"))

    if recurrence_type == "repeat_weekly":
        normalized["start_date"] = (
            format_iso_date(start_date) if start_date else None
        )
        normalized["end_date"] = format_iso_date(end_date) if end_date else None
        return normalized

    if recurrence_type == "just_today":
        occurrence_date = next_occurrence_for_weekday(
            reference_date,
            day_of_week,
        )
        normalized["start_date"] = format_iso_date(occurrence_date)
        normalized["end_date"] = format_iso_date(occurrence_date)
        return normalized

    if start_date is None:
        start_date = reference_date

    if recurrence_type == "just_this_month":
        end_date = end_of_month(start_date)
    elif recurrence_type == "specified_end_date":
        if end_date is None:
            raise ValueError("Please select an end date")
    else:
        raise ValueError("Unsupported recurrence type")

    if end_date is not None and end_date < start_date:
        raise ValueError("End date cannot be earlier than start date")

    normalized["start_date"] = format_iso_date(start_date)
    normalized["end_date"] = format_iso_date(end_date) if end_date else None
    return normalized


def slot_applies_to_date(slot: Dict[str, Any], target_date: date_type) -> bool:
    recurrence_type = slot.get("recurrence_type") or "repeat_weekly"
    start_date = parse_iso_date(slot.get("start_date"))
    end_date = parse_iso_date(slot.get("end_date"))

    if start_date and target_date < start_date:
        return False

    if recurrence_type == "just_today":
        return start_date == target_date

    if end_date and target_date > end_date:
        return False

    return True


def slot_applies_to_service(slot: Dict[str, Any], service_id: Optional[str]) -> bool:
    service_ids = slot.get("service_ids") or []
    if not service_id or len(service_ids) == 0:
        return True
    return service_id in service_ids
