from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    create_note_if_missing,
    require_customer_context,
    require_provider_context,
)


def rebuild_customer_notes(db):
    customer_context = require_customer_context(db)
    provider_context = require_provider_context(db)
    for note_text in [
        "Prefers hot water wash before service",
        "Always books on Friday afternoons",
        "Allergic to certain hair products - use hypoallergenic line",
        "Likes to chat during appointments - friendly customer",
    ]:
        _, created = create_note_if_missing(
            db,
            customer_id=customer_context["profile_id"],
            provider_id=provider_context["profile_id"],
            note=note_text,
        )
        print(
            f"  [OK] Note {'created' if created else 'already exists'}: {note_text}"
        )


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Rebuilding customer_notes collection...", rebuild_customer_notes)
        else 1
    )
