from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    ensure_conversation_messages,
    get_first,
    require_customer_context,
    require_provider_context,
)


def rebuild_messages(db):
    customer_context = require_customer_context(db)
    provider_context = require_provider_context(db)
    conversation_doc = get_first(
        db.collection("conversations")
        .where("customer_id", "==", customer_context["user_id"])
        .where("provider_id", "==", provider_context["user_id"])
        .limit(1)
        .get()
    )
    if not conversation_doc:
        raise RuntimeError(
            "Conversation not found. Rebuild the conversations collection first."
        )

    created_messages = ensure_conversation_messages(
        db,
        conversation_id=conversation_doc.id,
        customer_user_id=customer_context["user_id"],
        provider_user_id=provider_context["user_id"],
    )
    print(f"  [OK] New messages created: {created_messages}")


if __name__ == "__main__":
    sys.exit(
        0 if run_collection_task("Rebuilding messages collection...", rebuild_messages) else 1
    )
