from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    TEST_CUSTOMER_EMAIL,
    TEST_PASSWORD,
    TEST_PROVIDER_EMAIL,
    ensure_user_document,
)


def rebuild_users(db):
    customer_user = ensure_user_document(
        db,
        email=TEST_CUSTOMER_EMAIL,
        role="Customer",
        password=TEST_PASSWORD,
    )
    customer_status = "created" if customer_user["created_in_auth"] else "updated"
    print(
        f"  [OK] Customer auth {customer_status}: {TEST_CUSTOMER_EMAIL}"
        f" (app user id: {customer_user['app_user_id']})"
    )

    provider_user = ensure_user_document(
        db,
        email=TEST_PROVIDER_EMAIL,
        role="Provider",
        password=TEST_PASSWORD,
    )
    provider_status = "created" if provider_user["created_in_auth"] else "updated"
    print(
        f"  [OK] Provider auth {provider_status}: {TEST_PROVIDER_EMAIL}"
        f" (app user id: {provider_user['app_user_id']})"
    )


if __name__ == "__main__":
    sys.exit(0 if run_collection_task("Rebuilding users collection...", rebuild_users) else 1)
