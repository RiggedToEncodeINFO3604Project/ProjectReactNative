"""
Orchestrate reconstruction of the identity-related Firestore collections.

Collection ownership now lives in separate per-collection scripts under
apps/api/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database
from firestore_collections.rebuild_customers import rebuild_customers
from firestore_collections.rebuild_providers import rebuild_providers
from firestore_collections.rebuild_users import rebuild_users
from firestore_collections.seed_helpers import (
    TEST_CUSTOMER_EMAIL,
    TEST_PASSWORD,
    TEST_PROVIDER_EMAIL,
)


def create_test_users():
    try:
        db = init_database()

        print("Creating Firebase-backed test users...")
        print()

        rebuild_users(db)
        rebuild_customers(db)
        rebuild_providers(db)

        print()
        print("Identity collections are ready.")
        print()
        print("Login credentials:")
        print(f"  Customer: {TEST_CUSTOMER_EMAIL} / {TEST_PASSWORD}")
        print(f"  Provider: {TEST_PROVIDER_EMAIL} / {TEST_PASSWORD}")
        return True
    except Exception as exc:
        print(f"Error: {exc}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    sys.exit(0 if create_test_users() else 1)
