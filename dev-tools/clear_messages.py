"""
Clear messaging-related Firestore collections.

Destructive ownership lives in separate per-collection scripts under
dev-tools/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database, run_script_task, run_steps
from firestore_collections.destroy_conversations import destroy_conversations
from firestore_collections.destroy_messages import destroy_messages


def clear_messages() -> None:
    db = init_database()

    print("Deleting messaging data...")
    print()
    run_steps(
        [
            ("Destroying messages", lambda: destroy_messages(db)),
            ("Destroying conversations", lambda: destroy_conversations(db)),
        ]
    )
    print("Messaging data cleared successfully.")


if __name__ == "__main__":
    print("Clearing Firebase Firestore messaging data...")
    print()
    success = run_script_task(clear_messages, failure_prefix="Messaging data clear failed")
    if success:
        sys.exit(0)
    sys.exit(1)
