"""
Orchestrate reconstruction of the non-identity Firestore test collections.

Each collection's create logic now lives in its own rebuild script under
dev-tools/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database, run_script_task, run_steps
from firestore_collections.rebuild_availability import rebuild_availability
from firestore_collections.rebuild_client_records import rebuild_client_records
from firestore_collections.rebuild_conversations import rebuild_conversations
from firestore_collections.rebuild_customer_notes import rebuild_customer_notes
from firestore_collections.rebuild_customer_tags import rebuild_customer_tags
from firestore_collections.rebuild_messages import rebuild_messages
from firestore_collections.rebuild_provider_busy_times import (
    rebuild_provider_busy_times,
)
from firestore_collections.rebuild_provider_tagging_rules import (
    rebuild_provider_tagging_rules,
)
from firestore_collections.rebuild_services import rebuild_services
from firestore_collections.seed_helpers import (
    get_first,
    require_customer_context,
    require_provider_context,
)


def create_test_bookings() -> None:
    db = init_database()

    print("=" * 60)
    print("  Test Data Creation")
    print("=" * 60)
    print()

    run_steps(
        [
            ("Rebuilding services", lambda: rebuild_services(db)),
            ("Rebuilding availability", lambda: rebuild_availability(db)),
            ("Rebuilding provider busy times", lambda: rebuild_provider_busy_times(db)),
            (
                "Rebuilding provider tagging rules",
                lambda: rebuild_provider_tagging_rules(db),
            ),
            ("Rebuilding client records", lambda: rebuild_client_records(db)),
            ("Rebuilding customer tags", lambda: rebuild_customer_tags(db)),
            ("Rebuilding customer notes", lambda: rebuild_customer_notes(db)),
            ("Rebuilding conversations", lambda: rebuild_conversations(db)),
            ("Rebuilding messages", lambda: rebuild_messages(db)),
        ]
    )

    customer_context = require_customer_context(db)
    provider_context = require_provider_context(db)
    conversation_doc = get_first(
        db.collection("conversations")
        .where("customer_id", "==", customer_context["user_id"])
        .where("provider_id", "==", provider_context["user_id"])
        .limit(1)
        .get()
    )

    print("=" * 60)
    print("  Test Data Created Successfully")
    print("=" * 60)
    print()
    print("Test summary:")
    print(f"  Customer ID: {customer_context['profile_id']}")
    print(f"  Provider ID: {provider_context['profile_id']}")
    print(f"  Conversation ID: {conversation_doc.id if conversation_doc else 'N/A'}")
    print()
    print("Provider snapshot endpoint:")
    print(
        f"  GET http://localhost:8003/provider/customer/{customer_context['profile_id']}/snapshot"
    )
    print()


if __name__ == "__main__":
    sys.exit(
        0
        if run_script_task(create_test_bookings, failure_prefix="Test data creation failed")
        else 1
    )
