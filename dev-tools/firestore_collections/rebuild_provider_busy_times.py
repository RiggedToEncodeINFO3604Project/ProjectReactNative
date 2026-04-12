from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    ensure_provider_busy_time,
    require_provider_context,
)


def rebuild_provider_busy_times(db):
    provider_context = require_provider_context(db)
    busy_time_id, created = ensure_provider_busy_time(db, provider_context["profile_id"])
    print(
        f"  [OK] Busy time {'created' if created else 'updated'}: {busy_time_id}"
    )


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task(
            "Rebuilding provider_busy_times collection...",
            rebuild_provider_busy_times,
        )
        else 1
    )
