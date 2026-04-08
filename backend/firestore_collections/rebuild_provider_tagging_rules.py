from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    ensure_provider_tagging_rules,
    require_provider_context,
)


def rebuild_provider_tagging_rules(db):
    provider_context = require_provider_context(db)
    rules_id, created = ensure_provider_tagging_rules(db, provider_context["profile_id"])
    print(f"  [OK] Tagging rules {'created' if created else 'updated'}: {rules_id}")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task(
            "Rebuilding provider_tagging_rules collection...",
            rebuild_provider_tagging_rules,
        )
        else 1
    )
