from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_provider_busy_times(db):
    print("Deleting 'provider_busy_times' collection...")
    delete_collection_documents(db, "provider_busy_times")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task(
            "Destroying provider_busy_times collection...",
            destroy_provider_busy_times,
        )
        else 1
    )
