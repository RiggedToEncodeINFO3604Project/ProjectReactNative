from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_client_records(db):
    print("Deleting 'client_records' collection...")
    delete_collection_documents(db, "client_records")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task("Destroying client_records collection...", destroy_client_records)
        else 1
    )
