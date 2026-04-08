from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firestore_collections.common import delete_collection_documents, run_collection_task


def destroy_provider_tagging_rules(db):
    print("Deleting 'provider_tagging_rules' collection...")
    delete_collection_documents(db, "provider_tagging_rules")


if __name__ == "__main__":
    sys.exit(
        0
        if run_collection_task(
            "Destroying provider_tagging_rules collection...",
            destroy_provider_tagging_rules,
        )
        else 1
    )
