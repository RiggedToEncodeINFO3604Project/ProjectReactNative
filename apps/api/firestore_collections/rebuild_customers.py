from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    TEST_CUSTOMER_EMAIL,
    ensure_customer_profile,
    require_user_doc_by_email,
)


def rebuild_customers(db):
    customer_user_doc = require_user_doc_by_email(db, TEST_CUSTOMER_EMAIL, "Customer")
    customer_profile_id, created = ensure_customer_profile(db, customer_user_doc.id)
    print(
        f"  [OK] Customer profile {'created' if created else 'updated'}: {customer_profile_id}"
    )


if __name__ == "__main__":
    sys.exit(
        0 if run_collection_task("Rebuilding customers collection...", rebuild_customers) else 1
    )
