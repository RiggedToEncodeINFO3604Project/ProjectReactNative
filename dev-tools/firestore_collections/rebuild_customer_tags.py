from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    create_tag_if_missing,
    require_customer_context,
    require_provider_context,
)


def rebuild_customer_tags(db):
    customer_context = require_customer_context(db)
    provider_context = require_provider_context(db)
    for tag_name, tag_color in [
        ("VIP Customer", "#f0c85a"),
        ("Loyal Client", "#34C759"),
        ("Prefers Evenings", "#007AFF"),
    ]:
        _, created = create_tag_if_missing(
            db,
            customer_id=customer_context["profile_id"],
            provider_id=provider_context["profile_id"],
            tag=tag_name,
            color=tag_color,
        )
        print(f"  [OK] Tag {'created' if created else 'already exists'}: {tag_name}")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Rebuilding customer_tags collection...", rebuild_customer_tags)
        else 1
    )
