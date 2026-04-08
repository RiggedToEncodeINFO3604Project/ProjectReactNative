from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    create_booking_if_missing,
    require_customer_context,
    require_provider_context,
    require_provider_services,
    stable_seed_datetime,
)


def rebuild_client_records(db):
    customer_context = require_customer_context(db)
    provider_context = require_provider_context(db)
    services = require_provider_services(
        db,
        provider_context["profile_id"],
        ["Haircut", "Hair Styling", "Beard Trim"],
    )

    booking_specs = [
        (stable_seed_datetime(90), "Haircut"),
        (stable_seed_datetime(60), "Hair Styling"),
        (stable_seed_datetime(30), "Beard Trim"),
        (stable_seed_datetime(15), "Haircut"),
        (stable_seed_datetime(7), "Hair Styling"),
    ]

    created_bookings = 0
    for booking_date, service_name in booking_specs:
        service_entry = services[service_name]
        _, created = create_booking_if_missing(
            db,
            customer_id=customer_context["profile_id"],
            service_id=service_entry["id"],
            booking_date=booking_date,
            start_time="14:00",
            end_time="14:30",
            cost=service_entry["price"],
        )
        if created:
            created_bookings += 1
        print(
            f"  [OK] Booking {'created' if created else 'already exists'}:"
            f" {booking_date.strftime('%Y-%m-%d')} {service_name}"
        )

    print(f"  [OK] Total new bookings created: {created_bookings}")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Rebuilding client_records collection...", rebuild_client_records)
        else 1
    )
