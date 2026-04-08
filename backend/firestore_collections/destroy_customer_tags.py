from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_customer_tags(db):
    print("Deleting 'customer_tags' collection...")
    delete_collection_documents(db, "customer_tags")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Destroying customer_tags collection...", destroy_customer_tags)
        else 1
    )
