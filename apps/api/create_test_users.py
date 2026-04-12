"""
Orchestrate reconstruction of the identity-related Firestore collections.

Collection ownership now lives in separate per-collection scripts under
apps/api/firestore_collections/.
"""

import sys

from firestore_collections.common import init_database, run_script_task, run_steps
from firestore_collections.rebuild_customers import rebuild_customers
from firestore_collections.rebuild_providers import rebuild_providers
from firestore_collections.rebuild_users import rebuild_users
from firestore_collections.seed_helpers import (
    TEST_CUSTOMER_EMAIL,
    TEST_PASSWORD,
    TEST_PROVIDER_EMAIL,
)


def create_test_users() -> None:
    db = init_database()

    print("Creating Firebase-backed test users...")
    print()

    run_steps(
        [
            ("Rebuilding users", lambda: rebuild_users(db)),
            ("Rebuilding customers", lambda: rebuild_customers(db)),
            ("Rebuilding providers", lambda: rebuild_providers(db)),
        ]
    )

    print("Identity collections are ready.")
    print()
    print("Login credentials:")
    print(f"  Customer: {TEST_CUSTOMER_EMAIL} / {TEST_PASSWORD}")
    print(f"  Provider: {TEST_PROVIDER_EMAIL} / {TEST_PASSWORD}")


if __name__ == "__main__":
    sys.exit(
        0
        if run_script_task(create_test_users, failure_prefix="Test user setup failed")
        else 1
    )
