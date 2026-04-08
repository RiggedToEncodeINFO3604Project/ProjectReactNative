"""
Orchestrate destructive Firestore resets collection by collection.

Each collection's delete logic lives in its own destroy script under
apps/api/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database
from firestore_collections.destroy_availability import destroy_availability
from firestore_collections.destroy_client_records import destroy_client_records
from firestore_collections.destroy_conversations import destroy_conversations
from firestore_collections.destroy_customer_notes import destroy_customer_notes
from firestore_collections.destroy_customer_tags import destroy_customer_tags
from firestore_collections.destroy_customers import destroy_customers
from firestore_collections.destroy_messages import destroy_messages
from firestore_collections.destroy_provider_busy_times import (
    destroy_provider_busy_times,
)
from firestore_collections.destroy_provider_tagging_rules import (
    destroy_provider_tagging_rules,
)
from firestore_collections.destroy_providers import destroy_providers
from firestore_collections.destroy_services import destroy_services
from firestore_collections.destroy_users import destroy_users


def reset_database():
    try:
        db = init_database()

        destroy_messages(db)
        destroy_conversations(db)
        destroy_client_records(db)
        destroy_customer_notes(db)
        destroy_customer_tags(db)
        destroy_provider_busy_times(db)
        destroy_provider_tagging_rules(db)
        destroy_availability(db)
        destroy_services(db)
        destroy_customers(db)
        destroy_providers(db)
        destroy_users(db)

        print("\nDatabase reset complete!")
        return True

    except Exception as exc:
        print(f"Error: {exc}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("Resetting Firebase Firestore database...")
    print()
    success = reset_database()
    if success:
        sys.exit(0)
    print("Database reset failed.")
    sys.exit(1)
