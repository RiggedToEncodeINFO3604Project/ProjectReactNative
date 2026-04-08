from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    ensure_provider_availability,
    get_provider_services_by_name,
    require_provider_context,
)


def rebuild_availability(db):
    provider_context = require_provider_context(db)
    provider_id = provider_context["profile_id"]
    services = get_provider_services_by_name(db, provider_id)
    if not services:
        raise RuntimeError(
            "No services found for the test provider. Rebuild the services collection first."
        )

    availability_id, created = ensure_provider_availability(
        db,
        provider_id=provider_id,
        service_ids=[service["id"] for service in services.values()],
    )
    print(
        f"  [OK] Availability {'created' if created else 'updated'}: {availability_id}"
    )


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Rebuilding availability collection...", rebuild_availability)
        else 1
    )
