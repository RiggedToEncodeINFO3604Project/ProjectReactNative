from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    ensure_conversation,
    require_customer_context,
    require_provider_context,
)


def rebuild_conversations(db):
    customer_context = require_customer_context(db)
    provider_context = require_provider_context(db)
    conversation_id, created = ensure_conversation(
        db,
        customer_user_id=customer_context["user_id"],
        provider_user_id=provider_context["user_id"],
        customer_name=customer_context["profile"].get("name", "Test Customer"),
        provider_name=provider_context["profile"].get("provider_name", "Test Provider"),
    )
    print(
        f"  [OK] Conversation {'created' if created else 'updated'}: {conversation_id}"
    )


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Rebuilding conversations collection...", rebuild_conversations)
        else 1
    )
