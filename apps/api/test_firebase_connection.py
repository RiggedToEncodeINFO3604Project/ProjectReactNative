"""Smoke-test the Firebase Firestore connection used by local tooling."""

import sys

from firestore_collections.common import init_database, print_script_error


def test_firebase_connection() -> None:
    print("Testing Firebase connection...")
    db = init_database()

    # Smoke-test a simple read to confirm Firestore access works.
    list(db.collection("users").limit(1).stream())

    print("[OK] Connected to Firebase Firestore.")
    print("[OK] Firestore read access verified.")


def main() -> int:
    try:
        test_firebase_connection()
        return 0
    except Exception as exc:
        print_script_error("Firebase connection test failed", exc)
        print()
        print("Tips for troubleshooting:")
        print("1. Make sure FIREBASE_CREDENTIALS is set in your environment or .env file.")
        print("2. Verify that the Firebase service account JSON is valid.")
        print("3. Ensure the Firebase project is active and Firestore is enabled.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
