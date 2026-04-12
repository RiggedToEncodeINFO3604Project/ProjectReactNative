from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_availability(db):
    print("Deleting 'availability' collection...")
    delete_collection_documents(db, "availability")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Destroying availability collection...", destroy_availability)
        else 1
    )
