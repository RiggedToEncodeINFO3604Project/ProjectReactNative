"""
Orchestrate destructive Firestore resets collection by collection.

Each collection's delete logic lives in its own destroy script under
apps/api/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database, run_script_task, run_steps
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


def reset_database() -> None:
    db = init_database()
    run_steps(
        [
            ("Destroying messages", lambda: destroy_messages(db)),
            ("Destroying conversations", lambda: destroy_conversations(db)),
            ("Destroying client records", lambda: destroy_client_records(db)),
            ("Destroying customer notes", lambda: destroy_customer_notes(db)),
            ("Destroying customer tags", lambda: destroy_customer_tags(db)),
            ("Destroying provider busy times", lambda: destroy_provider_busy_times(db)),
            (
                "Destroying provider tagging rules",
                lambda: destroy_provider_tagging_rules(db),
            ),
            ("Destroying availability", lambda: destroy_availability(db)),
            ("Destroying services", lambda: destroy_services(db)),
            ("Destroying customers", lambda: destroy_customers(db)),
            ("Destroying providers", lambda: destroy_providers(db)),
            ("Destroying users", lambda: destroy_users(db)),
        ]
    )
    print("Database reset complete!")


if __name__ == "__main__":
    print("Resetting Firebase Firestore database...")
    print()
    success = run_script_task(reset_database, failure_prefix="Database reset failed")
    if success:
        sys.exit(0)
    sys.exit(1)
