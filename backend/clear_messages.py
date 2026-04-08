"""
Clear messaging-related Firestore collections.

Destructive ownership lives in separate per-collection scripts under
backend/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database
from firestore_collections.destroy_conversations import destroy_conversations
from firestore_collections.destroy_messages import destroy_messages


def clear_messages():
    try:
        db = init_database()

        print("Deleting messaging data...")
        print()
        destroy_messages(db)
        destroy_conversations(db)
        print()
        print("Messaging data cleared successfully.")
        return True
    except Exception as exc:
        print(f"Error: {exc}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("Clearing Firebase Firestore messaging data...")
    print()
    success = clear_messages()
    if success:
        sys.exit(0)
    print("Messaging data clear failed.")
    sys.exit(1)
