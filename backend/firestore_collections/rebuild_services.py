from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    SERVICE_CATALOG,
    ensure_service,
    require_provider_context,
)


def rebuild_services(db):
    provider_context = require_provider_context(db)
    provider_id = provider_context["profile_id"]

    for service in SERVICE_CATALOG:
        service_id, created = ensure_service(
            db,
            provider_id=provider_id,
            name=service["name"],
            description=service["description"],
            price=service["price"],
            duration=service["duration"],
        )
        print(
            f"  [OK] Service {'created' if created else 'updated'}:"
            f" {service['name']} ({service_id})"
        )


if __name__ == "__main__":
    sys.exit(
        0 if run_collection_task("Rebuilding services collection...", rebuild_services) else 1
    )
