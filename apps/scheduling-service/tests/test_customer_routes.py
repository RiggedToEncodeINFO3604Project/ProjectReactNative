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
from routes import customer_routes


def make_doc(doc_id: str, data: dict | None = None, *, exists: bool = True):
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = exists
    doc.to_dict.return_value = data or {}
    doc.reference = MagicMock()
    return doc


class CustomerRouteTests(unittest.TestCase):
    def setUp(self):
        self.created_at = datetime(2026, 4, 12, 12, 0, tzinfo=timezone.utc)
        self.current_user = UserInDB(
            _id="customer-user-1",
            email="customer@example.com",
            role=UserRole.CUSTOMER,
            password="hashed-password",
            created_at=self.created_at,
        )

        app = FastAPI()
        app.include_router(customer_routes.router)
        app.dependency_overrides[customer_routes.get_current_customer] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_search_providers_returns_active_provider_and_services(self):
        provider_doc = make_doc(
            "provider-1",
            {
                "provider_name": "Kai Styles",
                "business_name": "Kai Cuts",
                "bio": "Precision barber",
                "provider_address": "42 Main Street",
                "is_active": True,
            },
        )
        service_doc = make_doc(
            "service-1",
            {
                "provider_id": "provider-1",
                "name": "Haircut",
                "description": "Classic cut",
                "price": 40,
            },
        )

        providers_query = MagicMock()
        providers_query.get.return_value = [provider_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query

        services_query = MagicMock()
        services_query.get.return_value = [service_doc]
        services_collection = MagicMock()
        services_collection.where.return_value = services_query

        db = MagicMock()

        def collection_side_effect(name: str):
            if name == "providers":
                return providers_collection
            if name == "services":
                return services_collection
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with patch.object(customer_routes, "get_database", return_value=db):
            response = self.client.get(
                "/customer/providers/search",
                params={"name": "kai"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            [
                {
                    "id": "provider-1",
                    "provider_name": "Kai Styles",
                    "business_name": "Kai Cuts",
                    "bio": "Precision barber",
                    "provider_address": "42 Main Street",
                    "is_active": True,
                    "services": [
                        {
                            "id": "service-1",
                            "provider_id": "provider-1",
                            "name": "Haircut",
                            "description": "Classic cut",
                            "price": 40,
                        }
                    ],
                }
            ],
        )

    def test_get_provider_availability_filters_bookings_and_busy_times(self):
        target_date = datetime(2026, 4, 13, 9, 0, tzinfo=timezone.utc)
        availability_doc = make_doc(
            "availability-1",
            {
                "provider_id": "provider-1",
                "schedule": [
                    {
                        "day_of_week": 0,
                        "time_slots": [
                            {
                                "start_time": "09:00",
                                "end_time": "10:00",
                                "session_duration": 30,
                            }
                        ],
                    }
                ],
            },
        )
        service_doc = make_doc(
            "service-1",
            {
                "provider_id": "provider-1",
                "name": "Haircut",
                "description": "Classic cut",
                "price": 40,
            },
        )
        booking_doc = make_doc(
            "booking-1",
            {
                "date": target_date,
                "status": "confirmed",
                "start_time": "09:00",
                "end_time": "09:30",
            },
        )
        busy_doc = make_doc(
            "busy-1",
            {
                "provider_id": "provider-1",
                "date": "2026-04-13",
                "start_time": "09:30",
                "end_time": "10:00",
            },
        )

        availability_query = MagicMock()
        availability_query.limit.return_value = availability_query
        availability_query.get.return_value = [availability_doc]
        availability_collection = MagicMock()
        availability_collection.where.return_value = availability_query

        services_query = MagicMock()
        services_query.get.return_value = [service_doc]
        services_collection = MagicMock()
        services_collection.where.return_value = services_query

        client_records_query = MagicMock()
        client_records_query.get.return_value = [booking_doc]
        client_records_collection = MagicMock()
        client_records_collection.where.return_value = client_records_query

        busy_query = MagicMock()
        busy_query.where.return_value = busy_query
        busy_query.get.return_value = [busy_doc]
        busy_collection = MagicMock()
        busy_collection.where.return_value = busy_query

        db = MagicMock()

        def collection_side_effect(name: str):
            mapping = {
                "availability": availability_collection,
                "services": services_collection,
                "client_records": client_records_collection,
                "provider_busy_times": busy_collection,
            }
            return mapping[name]

        db.collection.side_effect = collection_side_effect

        with patch.object(customer_routes, "get_database", return_value=db):
            response = self.client.get(
                "/customer/providers/provider-1/availability/2026-04-13",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"available_slots": []})



if __name__ == "__main__":
    unittest.main()
