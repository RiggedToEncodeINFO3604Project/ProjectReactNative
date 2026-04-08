from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_conversations(db):
    print("Deleting 'conversations' collection...")
    delete_collection_documents(db, "conversations")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Destroying conversations collection...", destroy_conversations)
        else 1
    )
