"""Shared helpers for Firestore maintenance and seed scripts."""

from __future__ import annotations

import sys
import traceback
from collections.abc import Callable, Iterable, Sequence
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from firebase_db import get_database, initialize_firebase

StepCallback = Callable[[], object]
DatabaseCallback = Callable[[object], object]


def init_database():
    initialize_firebase()
    return get_database()


def delete_references_in_batches(db, references: Iterable, label: str) -> int:
    deleted = 0
    batch = db.batch()
    batch_count = 0

    for reference in references:
        batch.delete(reference)
        deleted += 1
        batch_count += 1

        if batch_count >= 500:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    print(f"  [OK] Deleted {deleted} document(s) from {label}")
    return deleted


def delete_collection_documents(db, collection_name: str) -> int:
    refs = [doc.reference for doc in db.collection(collection_name).stream()]
    return delete_references_in_batches(db, refs, collection_name)


def delete_nested_conversation_messages(db) -> int:
    refs = []
    for doc in db.collection_group("messages").stream():
        path_parts = doc.reference.path.split("/")
        if len(path_parts) == 4 and path_parts[0] == "conversations":
            refs.append(doc.reference)
    return delete_references_in_batches(
        db,
        refs,
        "conversation message subcollections",
    )


def run_steps(steps: Sequence[tuple[str, StepCallback]]) -> None:
    total_steps = len(steps)
    for index, (label, callback) in enumerate(steps, start=1):
        print(f"[{index}/{total_steps}] {label}...")
        callback()
        print()


def print_script_error(prefix: str, exc: Exception) -> None:
    print(f"{prefix}: {exc}")
    traceback.print_exc()


def run_script_task(callback: Callable[[], object], failure_prefix: str = "Error") -> bool:
    try:
        callback()
        return True
    except Exception as exc:
        print_script_error(failure_prefix, exc)
        return False


def run_collection_task(title: str, callback: DatabaseCallback) -> bool:
    try:
        print(title)
        print()
        db = init_database()
        callback(db)
        print()
        print("Completed successfully.")
        return True
    except Exception as exc:
        print_script_error("[ERROR]", exc)
        return False
