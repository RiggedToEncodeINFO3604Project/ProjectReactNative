from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import run_collection_task
from firestore_collections.seed_helpers import (
    TEST_PROVIDER_EMAIL,
    ensure_provider_profile,
    require_user_doc_by_email,
)


def rebuild_providers(db):
    provider_user_doc = require_user_doc_by_email(db, TEST_PROVIDER_EMAIL, "Provider")
    provider_profile_id, created = ensure_provider_profile(db, provider_user_doc.id)
    print(
        f"  [OK] Provider profile {'created' if created else 'updated'}: {provider_profile_id}"
    )


if __name__ == "__main__":
    sys.exit(
        0 if run_collection_task("Rebuilding providers collection...", rebuild_providers) else 1
    )
