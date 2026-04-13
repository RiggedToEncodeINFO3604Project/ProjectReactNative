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
from routes import provider_routes


def make_doc(doc_id: str, data: dict | None = None, *, exists: bool = True):
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = exists
    doc.to_dict.return_value = data or {}
    doc.reference = MagicMock()
    return doc


class ProviderRouteTests(unittest.TestCase):
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
        app.include_router(provider_routes.router)
        app.dependency_overrides[provider_routes.get_current_provider] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_add_service_creates_service_for_current_provider(self):
        provider_doc = make_doc(
            "provider-1",
            {"user_id": "provider-user-1", "provider_name": "Kai Styles"},
        )

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        services_collection = MagicMock()
        service_doc_ref = MagicMock()
        services_collection.document.return_value = service_doc_ref

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "services": services_collection,
        }[name]

        with (
            patch.object(provider_routes, "get_database", return_value=db),
            patch.object(provider_routes.uuid, "uuid4", return_value="service-123"),
        ):
            response = self.client.post(
                "/provider/services",
                json={
                    "provider_id": "ignored-by-route",
                    "name": "Haircut",
                    "description": "Classic cut",
                    "price": 45,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "id": "service-123",
                "provider_id": "provider-1",
                "name": "Haircut",
                "description": "Classic cut",
                "price": 45.0,
            },
        )
        service_doc_ref.set.assert_called_once_with(
            {
                "provider_id": "provider-1",
                "name": "Haircut",
                "description": "Classic cut",
                "price": 45.0,
            }
        )

    def test_set_availability_rejects_invalid_service_selection(self):
        provider_doc = make_doc(
            "provider-1",
            {"user_id": "provider-user-1", "provider_name": "Kai Styles"},
        )
        existing_service_doc = make_doc("service-1", {"provider_id": "provider-1"})

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        services_query = MagicMock()
        services_query.get.return_value = [existing_service_doc]
        services_collection = MagicMock()
        services_collection.where.return_value = services_query

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "providers": providers_collection,
            "services": services_collection,
        }[name]

        with patch.object(provider_routes, "get_database", return_value=db):
            response = self.client.post(
                "/provider/availability",
                json={
                    "provider_id": "provider-1",
                    "schedule": [
                        {
                            "day_of_week": 0,
                            "time_slots": [
                                {
                                    "start_time": "09:00",
                                    "end_time": "10:00",
                                    "session_duration": 30,
                                    "service_ids": ["missing-service"],
                                }
                            ],
                        }
                    ],
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Availability contains invalid service selections",
        )

    def test_accept_booking_confirms_target_and_cancels_overlapping_pending_bookings(self):
        booking_doc = make_doc(
            "booking-1",
            {
                "service_id": "service-1",
                "date": datetime(2026, 4, 13, 0, 0, tzinfo=timezone.utc),
                "start_time": "09:00",
                "end_time": "09:30",
                "status": "pending",
            },
        )
        service_doc = make_doc("service-1", {"provider_id": "provider-1"})
        provider_doc = make_doc("provider-1", {"user_id": "provider-user-1"})
        overlapping_booking = make_doc("booking-2", {"status": "pending"})

        booking_doc_ref = MagicMock()
        booking_doc_ref.get.return_value = booking_doc
        client_records_collection = MagicMock()
        client_records_collection.document.return_value = booking_doc_ref

        overlapping_query = MagicMock()
        overlapping_query.where.return_value = overlapping_query
        overlapping_query.get.return_value = [overlapping_booking, booking_doc]
        client_records_collection.where.return_value = overlapping_query

        service_doc_ref = MagicMock()
        service_doc_ref.get.return_value = service_doc
        services_collection = MagicMock()
        services_collection.document.return_value = service_doc_ref
        services_query = MagicMock()
        services_query.get.return_value = [service_doc]
        services_collection.where.return_value = services_query

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        db = MagicMock()
        batch = MagicMock()
        db.batch.return_value = batch
        db.collection.side_effect = lambda name: {
            "client_records": client_records_collection,
            "services": services_collection,
            "providers": providers_collection,
        }[name]

        with patch.object(provider_routes, "get_database", return_value=db):
            response = self.client.post("/provider/bookings/booking-1/accept")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Booking accepted"})
        booking_doc_ref.update.assert_called_once_with({"status": "confirmed"})
        batch.update.assert_called_once_with(
            overlapping_booking.reference,
            {"status": "cancelled"},
        )
        batch.commit.assert_called_once()

    def test_get_available_slots_range_rejects_end_date_before_start_date(self):
        with (
            patch.object(provider_routes, "get_database", return_value=MagicMock()),
            patch.object(
                provider_routes,
                "get_provider_reschedule_context",
                return_value={
                    "booking_data": {"service_id": "service-1"},
                    "provider_id": "provider-1",
                    "availability": None,
                    "service_ids": [],
                },
            ),
        ):
            response = self.client.get(
                "/provider/bookings/booking-1/available-slots-range",
                params={
                    "start_date": "2026-04-20",
                    "end_date": "2026-04-19",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "End date cannot be earlier than start date",
        )


if __name__ == "__main__":
    unittest.main()
