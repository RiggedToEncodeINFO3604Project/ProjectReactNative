from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firebase_admin import auth as firebase_auth

from firestore_collections.common import delete_collection_documents, run_collection_task


AUTH_DELETE_BATCH_SIZE = 1000


def _iter_firebase_auth_users():
    page = firebase_auth.list_users()
    while page is not None:
        for user in page.users:
            yield user
        page = page.get_next_page()


def _delete_firebase_auth_users() -> int:
    user_ids = [user.uid for user in _iter_firebase_auth_users()]
    if not user_ids:
        print("  [OK] Deleted 0 Firebase Auth account(s)")
        return 0

    deleted = 0
    for start in range(0, len(user_ids), AUTH_DELETE_BATCH_SIZE):
        batch_uids = user_ids[start : start + AUTH_DELETE_BATCH_SIZE]
        result = firebase_auth.delete_users(batch_uids)
        deleted += result.success_count

        if getattr(result, "failure_count", 0):
            raise RuntimeError(
                f"Failed to delete {result.failure_count} Firebase Auth account(s)"
            )

    print(f"  [OK] Deleted {deleted} Firebase Auth account(s)")
    return deleted


def destroy_users(db):
    print("Deleting 'users' collection...")
    _delete_firebase_auth_users()
    delete_collection_documents(db, "users")


if __name__ == "__main__":
    sys.exit(0 if run_collection_task("Destroying users collection...", destroy_users) else 1)
