import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


DEV_TOOLS_DIR = Path(__file__).resolve().parent
if str(DEV_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(DEV_TOOLS_DIR))

if "config" not in sys.modules:
    fake_config = types.ModuleType("config")
    fake_config.settings = SimpleNamespace(firebase_credentials="")
    sys.modules["config"] = fake_config

if "firebase_admin" not in sys.modules:
    fake_firebase_admin = types.ModuleType("firebase_admin")
    fake_firebase_admin.auth = SimpleNamespace(
        UserNotFoundError=Exception,
        delete_user=MagicMock(),
        delete_users=MagicMock(),
        get_user_by_email=MagicMock(),
        list_users=MagicMock(),
    )
    fake_firebase_admin.credentials = SimpleNamespace(Certificate=MagicMock())
    fake_firebase_admin.firestore = SimpleNamespace(client=MagicMock())
    fake_firebase_admin._apps = {}
    fake_firebase_admin.initialize_app = MagicMock()
    fake_firebase_admin.delete_app = MagicMock()
    sys.modules["firebase_admin"] = fake_firebase_admin

from firestore_collections import destroy_users


def make_doc(doc_id: str, data: dict | None = None):
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = data or {}
    return doc


class DestroyUsersTests(unittest.TestCase):
    def test_destroy_users_deletes_all_firebase_auth_accounts_before_firestore_docs(self):
        db = MagicMock()
        db.collection.return_value.stream.return_value = [make_doc("app-user-1")]
        page = SimpleNamespace(
            users=[
                SimpleNamespace(uid="firebase-user-1"),
                SimpleNamespace(uid="firebase-user-2"),
            ],
            get_next_page=MagicMock(return_value=None),
        )

        with (
            patch.object(
                destroy_users.firebase_auth,
                "list_users",
                return_value=page,
            ) as list_users_mock,
            patch.object(
                destroy_users.firebase_auth,
                "delete_users",
                return_value=SimpleNamespace(success_count=2, failure_count=0),
            ) as delete_users_mock,
            patch.object(destroy_users, "delete_collection_documents") as delete_docs_mock,
        ):
            destroy_users.destroy_users(db)

        list_users_mock.assert_called_once_with()
        delete_users_mock.assert_called_once_with(["firebase-user-1", "firebase-user-2"])
        delete_docs_mock.assert_called_once_with(db, "users")

    def test_delete_firebase_auth_users_reads_multiple_pages(self):
        first_page = SimpleNamespace(
            users=[SimpleNamespace(uid="firebase-user-1")],
            get_next_page=MagicMock(),
        )
        second_page = SimpleNamespace(
            users=[SimpleNamespace(uid="firebase-user-2")],
            get_next_page=MagicMock(return_value=None),
        )
        first_page.get_next_page.return_value = second_page

        with (
            patch.object(
                destroy_users.firebase_auth,
                "list_users",
                return_value=first_page,
            ),
            patch.object(
                destroy_users.firebase_auth,
                "delete_users",
                return_value=SimpleNamespace(success_count=2, failure_count=0),
            ) as delete_users_mock,
        ):
            deleted = destroy_users._delete_firebase_auth_users()

        self.assertEqual(deleted, 2)
        delete_users_mock.assert_called_once_with(["firebase-user-1", "firebase-user-2"])


if __name__ == "__main__":
    unittest.main()
