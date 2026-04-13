import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from models import UserInDB, UserRole
from routes import snapshot_routes


def make_doc(doc_id: str, data: dict | None = None, *, exists: bool = True):
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = exists
    doc.to_dict.return_value = data or {}
    doc.reference = MagicMock()
    return doc


class SnapshotRouteTests(unittest.TestCase):
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
        app.include_router(snapshot_routes.router)
        app.dependency_overrides[snapshot_routes.get_current_provider] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_get_customer_snapshot_aggregates_customer_profile_tags_notes_and_totals(self):
        provider_doc = make_doc("provider-1", {"user_id": "provider-user-1"})
        customer_doc = make_doc(
            "customer-1",
            {
                "user_id": "user-2",
                "name": "Ava Customer",
                "phone": "+1-555-0100",
            },
        )
        user_doc = make_doc("user-2", {"email": "ava@example.com"})
        service_doc = make_doc("service-1", {"name": "Haircut"})
        tag_doc = make_doc(
            "tag-1",
            {"tag": "VIP", "color": "#ffcc00"},
        )
        note_doc = make_doc(
            "note-1",
            {
                "note": "Prefers morning appointments",
                "created_at": self.created_at,
                "updated_at": self.created_at,
                "provider_id": "provider-1",
            },
        )

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        customer_doc_ref = MagicMock()
        customer_doc_ref.get.return_value = customer_doc
        customers_collection = MagicMock()
        customers_collection.document.return_value = customer_doc_ref

        user_doc_ref = MagicMock()
        user_doc_ref.get.return_value = user_doc
        users_collection = MagicMock()
        users_collection.document.return_value = user_doc_ref

        service_doc_ref = MagicMock()
        service_doc_ref.get.return_value = service_doc
        services_collection = MagicMock()
        services_collection.document.return_value = service_doc_ref

        tags_query = MagicMock()
        tags_query.where.return_value = tags_query
        tags_query.get.return_value = [tag_doc]
        customer_tags_collection = MagicMock()
        customer_tags_collection.where.return_value = tags_query

        notes_query = MagicMock()
        notes_query.where.return_value = notes_query
        notes_query.order_by.return_value = notes_query
        notes_query.get.return_value = [note_doc]
        customer_notes_collection = MagicMock()
        customer_notes_collection.where.return_value = notes_query

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "customers": customers_collection,
            "users": users_collection,
            "services": services_collection,
            "customer_tags": customer_tags_collection,
            "customer_notes": customer_notes_collection,
        }[name]

        bookings = [
            {
                "date": datetime(2026, 4, 10, 0, 0, tzinfo=timezone.utc),
                "service_id": "service-1",
                "cost": 65,
            },
            {
                "date": datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
                "service_id": "service-1",
                "cost": 55,
            },
        ]
        auto_tags = [{"id": "auto-1", "tag": "Loyal", "color": "#00aa88", "weight": 5}]
        merged_tags = [
            {"id": "auto-1", "tag": "Loyal", "color": "#00aa88", "weight": 5},
            {"id": "tag-1", "tag": "VIP", "color": "#ffcc00", "weight": 0},
        ]

        with (
            patch.object(snapshot_routes, "get_database", return_value=db),
            patch.object(snapshot_routes, "get_customer_bookings", return_value=bookings),
            patch.object(snapshot_routes, "get_provider_tagging_config", return_value={"tag_priority": "manual_first"}),
            patch.object(snapshot_routes, "calculate_auto_tags", return_value=auto_tags),
            patch.object(snapshot_routes, "resolve_tag_priority", return_value=merged_tags),
        ):
            response = self.client.get("/provider/customer/customer-1/snapshot")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["customer_id"], "customer-1")
        self.assertEqual(body["customer_name"], "Ava Customer")
        self.assertEqual(body["customer_email"], "ava@example.com")
        self.assertEqual(body["total_visits"], 2)
        self.assertEqual(body["total_spent"], 120)
        self.assertEqual(body["last_service_date"], "2026-04-10")
        self.assertEqual(body["last_service_name"], "Haircut")
        self.assertEqual(body["tags"], merged_tags)
        self.assertEqual(body["auto_tags"], auto_tags)
        self.assertEqual(len(body["notes"]), 1)
        self.assertEqual(body["notes"][0]["id"], "note-1")

    def test_update_tagging_rules_merges_existing_configuration(self):
        provider_doc = make_doc("provider-1", {"user_id": "provider-user-1"})
        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        rules_doc_ref = MagicMock()
        rules_collection = MagicMock()
        rules_collection.document.return_value = rules_doc_ref

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "provider_tagging_rules": rules_collection,
        }[name]

        with (
            patch.object(snapshot_routes, "get_database", return_value=db),
            patch.object(
                snapshot_routes,
                "get_provider_tagging_config",
                return_value={"tag_priority": "manual_first", "vip_visit_threshold": 5},
            ),
        ):
            response = self.client.put(
                "/provider/tags/rules",
                json={"tag_priority": "auto_first"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": True,
                "config": {
                    "tag_priority": "auto_first",
                    "vip_visit_threshold": 5,
                },
            },
        )
        rules_doc_ref.set.assert_called_once_with(
            {
                "tag_priority": "auto_first",
                "vip_visit_threshold": 5,
            }
        )

    def test_create_customer_tag_uses_default_values_when_fields_are_missing(self):
        provider_doc = make_doc("provider-1", {"user_id": "provider-user-1"})
        customer_doc = make_doc("customer-1", {"name": "Ava Customer"})

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        customer_doc_ref = MagicMock()
        customer_doc_ref.get.return_value = customer_doc
        customers_collection = MagicMock()
        customers_collection.document.return_value = customer_doc_ref

        customer_tags_collection = MagicMock()
        tag_doc_ref = MagicMock()
        customer_tags_collection.document.return_value = tag_doc_ref

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "customers": customers_collection,
            "customer_tags": customer_tags_collection,
        }[name]

        with (
            patch.object(snapshot_routes, "get_database", return_value=db),
            patch.object(snapshot_routes.uuid, "uuid4", return_value="tag-123"),
            patch.object(snapshot_routes, "datetime") as datetime_mock,
        ):
            datetime_mock.now.return_value = self.created_at
            response = self.client.post(
                "/provider/customer/customer-1/tags",
                json={},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], "tag-123")
        self.assertEqual(response.json()["tag"], "Untitled")
        self.assertEqual(response.json()["color"], "#42bbeb")
        tag_doc_ref.set.assert_called_once()

    def test_update_customer_tag_rejects_updates_for_another_provider(self):
        provider_doc = make_doc("provider-1", {"user_id": "provider-user-1"})
        foreign_tag_doc = make_doc(
            "tag-1",
            {"provider_id": "other-provider", "tag": "VIP", "color": "#ffcc00"},
        )

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        foreign_tag_doc_ref = MagicMock()
        foreign_tag_doc_ref.get.return_value = foreign_tag_doc
        customer_tags_collection = MagicMock()
        customer_tags_collection.document.return_value = foreign_tag_doc_ref

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "customer_tags": customer_tags_collection,
        }[name]

        with patch.object(snapshot_routes, "get_database", return_value=db):
            response = self.client.put(
                "/provider/tags/tag-1",
                json={"tag": "Updated"},
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Not authorized to update this tag",
        )

    def test_delete_customer_note_removes_owned_note(self):
        provider_doc = make_doc("provider-1", {"user_id": "provider-user-1"})
        note_doc = make_doc(
            "note-1",
            {"provider_id": "provider-1", "note": "Prefers morning"},
        )
        note_doc_ref = MagicMock()
        note_doc_ref.get.return_value = note_doc

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        customer_notes_collection = MagicMock()
        customer_notes_collection.document.return_value = note_doc_ref

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "customer_notes": customer_notes_collection,
        }[name]

        with patch.object(snapshot_routes, "get_database", return_value=db):
            response = self.client.delete("/provider/notes/note-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"message": "Note deleted successfully", "note_id": "note-1"},
        )
        note_doc_ref.delete.assert_called_once()


if __name__ == "__main__":
    unittest.main()
