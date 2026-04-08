from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import (
    delete_collection_documents,
    delete_nested_conversation_messages,
    run_collection_task,
)


def destroy_messages(db):
    print("Deleting nested conversation message documents...")
    delete_nested_conversation_messages(db)
    print("Deleting top-level 'messages' collection...")
    delete_collection_documents(db, "messages")


if __name__ == "__main__":
    sys.exit(
        0 if run_collection_task("Destroying messages collection...", destroy_messages) else 1
    )
