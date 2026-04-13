from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_users(db):
    print("Deleting 'users' collection...")
    delete_collection_documents(db, "users")


if __name__ == "__main__":
    sys.exit(0 if run_collection_task("Destroying users collection...", destroy_users) else 1)
