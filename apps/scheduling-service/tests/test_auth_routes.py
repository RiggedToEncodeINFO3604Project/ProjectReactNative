import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from models import UserInDB, UserRole
from routes import auth_routes


def make_doc(doc_id: str, data: dict | None = None, *, exists: bool = True):
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = exists
    doc.to_dict.return_value = data or {}
    doc.reference = MagicMock()
    return doc


class AuthRouteTests(unittest.TestCase):
    def setUp(self):
        self.created_at = datetime(2026, 4, 12, 12, 0, tzinfo=timezone.utc)
        self.current_user = UserInDB(
            _id="provider-user-1",
            email="provider@example.com",
            role=UserRole.PROVIDER,
            password="hashed-password",
            created_at=self.created_at,
        )

        app = FastAPI()
        app.include_router(auth_routes.router)
        app.dependency_overrides[auth_routes.get_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_register_customer_creates_user_and_customer_documents(self):
        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch

        users_query = MagicMock()
        users_query.limit.return_value = users_query
        users_query.get.return_value = []

        users_collection = MagicMock()
        users_collection.where.return_value = users_query
        users_collection.document.side_effect = lambda doc_id: f"users/{doc_id}"

        customers_collection = MagicMock()
        customers_collection.document.side_effect = lambda doc_id: f"customers/{doc_id}"

        def collection_side_effect(name: str):
            if name == "users":
                return users_collection
            if name == "customers":
                return customers_collection
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with (
            patch.object(auth_routes, "get_database", return_value=db),
            patch.object(
                auth_routes.firebase_auth,
                "create_user",
                return_value=SimpleNamespace(uid="firebase-user-1"),
            ),
            patch.object(auth_routes.uuid, "uuid4", return_value="customer-uuid"),
            patch.object(auth_routes, "utc_now", return_value=self.created_at),
        ):
            response = self.client.post(
                "/auth/register/customer",
                json={
                    "email": "customer@example.com",
                    "password": "password123",
                    "name": "Ava Customer",
                    "phone": "+1-555-0100",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "message": "Customer registered successfully",
                "user_id": "firebase-user-1",
            },
        )
        batch.set.assert_any_call(
            "users/firebase-user-1",
            {
                "email": "customer@example.com",
                "role": "Customer",
                "created_at": self.created_at,
                "last_login": None,
                "firebase_uid": "firebase-user-1",
                "auth_provider": "firebase",
            },
        )
        batch.set.assert_any_call(
            "customers/customer-uuid",
            {
                "user_id": "firebase-user-1",
                "name": "Ava Customer",
                "phone": "+1-555-0100",
            },
        )
        batch.commit.assert_called_once()




if __name__ == "__main__":
    unittest.main()
