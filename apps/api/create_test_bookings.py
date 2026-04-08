"""
Orchestrate reconstruction of the non-identity Firestore test collections.

Each collection's create logic now lives in its own rebuild script under
apps/api/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database
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
from firestore_collections.seed_helpers import get_first, require_customer_context, require_provider_context


def create_test_bookings():
    try:
        db = init_database()

        print("=" * 60)
        print("  Test Data Creation")
        print("=" * 60)
        print()

        print("[1/9] Rebuilding services...")
        rebuild_services(db)
        print()

        print("[2/9] Rebuilding availability...")
        rebuild_availability(db)
        print()

        print("[3/9] Rebuilding provider busy times...")
        rebuild_provider_busy_times(db)
        print()

        print("[4/9] Rebuilding provider tagging rules...")
        rebuild_provider_tagging_rules(db)
        print()

        print("[5/9] Rebuilding client records...")
        rebuild_client_records(db)
        print()

        print("[6/9] Rebuilding customer tags...")
        rebuild_customer_tags(db)
        print()

        print("[7/9] Rebuilding customer notes...")
        rebuild_customer_notes(db)
        print()

        print("[8/9] Rebuilding conversations...")
        rebuild_conversations(db)
        print()

        print("[9/9] Rebuilding messages...")
        rebuild_messages(db)
        print()

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
            f"  GET http://localhost:8000/provider/customer/{customer_context['profile_id']}/snapshot"
        )
        print()
        return True
    except Exception as exc:
        print(f"  [ERROR] {exc}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    sys.exit(0 if create_test_bookings() else 1)
