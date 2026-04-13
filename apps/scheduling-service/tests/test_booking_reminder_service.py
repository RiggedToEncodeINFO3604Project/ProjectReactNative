import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from services import booking_reminder_service


def make_doc(doc_id: str, data: dict | None = None, *, exists: bool = True):
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = exists
    doc.to_dict.return_value = data or {}
    doc.reference = MagicMock()
    return doc


class BookingReminderServiceTests(unittest.TestCase):
    def test_process_due_booking_reminders_sends_day_before_notification(self):
        booking_doc = make_doc(
            "booking-1",
            {
                "customer_id": "customer-1",
                "service_id": "service-1",
                "date": datetime(2026, 4, 15, 0, 0, tzinfo=timezone.utc),
                "start_time": "15:00",
                "end_time": "15:30",
                "status": "confirmed",
                "reminder_day_before_sent_at": None,
                "reminder_two_hours_sent_at": None,
            },
        )
        customer_doc = make_doc("customer-1", {"user_id": "customer-user-1"})
        service_doc = make_doc(
            "service-1",
            {"name": "Haircut", "provider_id": "provider-1"},
        )
        provider_doc = make_doc("provider-1", {"provider_name": "Kai Styles"})

        bookings_query = MagicMock()
        bookings_query.get.return_value = [booking_doc]
        client_records_collection = MagicMock()
        client_records_collection.where.return_value = bookings_query

        customers_collection = MagicMock()
        customers_collection.document.return_value.get.return_value = customer_doc

        services_collection = MagicMock()
        services_collection.document.return_value.get.return_value = service_doc

        providers_collection = MagicMock()
        providers_collection.document.return_value.get.return_value = provider_doc

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "client_records": client_records_collection,
            "customers": customers_collection,
            "services": services_collection,
            "providers": providers_collection,
        }[name]

        sent_at = datetime(2026, 4, 14, 16, 5, tzinfo=timezone.utc)

        with (
            patch.object(
                booking_reminder_service,
                "get_schedule_timezone",
                return_value=timezone.utc,
            ),
            patch.object(
                booking_reminder_service,
                "send_booking_reminder_notification",
                return_value=True,
            ) as send_notification,
            patch.object(
                booking_reminder_service,
                "utc_now",
                return_value=sent_at,
            ),
        ):
            result = booking_reminder_service.process_due_booking_reminders(
                db=db,
                current_time=datetime(2026, 4, 14, 16, 0, tzinfo=timezone.utc),
            )

        self.assertEqual(result, {"checked": 1, "notifications_sent": 1})
        send_notification.assert_called_once_with(
            recipient_user_id="customer-user-1",
            provider_name="Kai Styles",
            service_name="Haircut",
            appointment_date="2026-04-15",
            appointment_time="15:00-15:30",
            reminder_type="day_before",
        )
        booking_doc.reference.update.assert_called_once_with(
            {"reminder_day_before_sent_at": sent_at}
        )

    def test_process_due_booking_reminders_sends_two_hour_notification_only(self):
        booking_doc = make_doc(
            "booking-1",
            {
                "customer_id": "customer-1",
                "service_id": "service-1",
                "date": datetime(2026, 4, 15, 0, 0, tzinfo=timezone.utc),
                "start_time": "15:00",
                "end_time": "15:30",
                "status": "confirmed",
                "reminder_day_before_sent_at": None,
                "reminder_two_hours_sent_at": None,
            },
        )
        customer_doc = make_doc("customer-1", {"user_id": "customer-user-1"})
        service_doc = make_doc(
            "service-1",
            {"name": "Haircut", "provider_id": "provider-1"},
        )
        provider_doc = make_doc("provider-1", {"provider_name": "Kai Styles"})

        bookings_query = MagicMock()
        bookings_query.get.return_value = [booking_doc]
        client_records_collection = MagicMock()
        client_records_collection.where.return_value = bookings_query

        customers_collection = MagicMock()
        customers_collection.document.return_value.get.return_value = customer_doc

        services_collection = MagicMock()
        services_collection.document.return_value.get.return_value = service_doc

        providers_collection = MagicMock()
        providers_collection.document.return_value.get.return_value = provider_doc

        db = MagicMock()
        db.collection.side_effect = lambda name: {
            "client_records": client_records_collection,
            "customers": customers_collection,
            "services": services_collection,
            "providers": providers_collection,
        }[name]

        sent_at = datetime(2026, 4, 15, 13, 5, tzinfo=timezone.utc)

        with (
            patch.object(
                booking_reminder_service,
                "get_schedule_timezone",
                return_value=timezone.utc,
            ),
            patch.object(
                booking_reminder_service,
                "send_booking_reminder_notification",
                return_value=True,
            ) as send_notification,
            patch.object(
                booking_reminder_service,
                "utc_now",
                return_value=sent_at,
            ),
        ):
            result = booking_reminder_service.process_due_booking_reminders(
                db=db,
                current_time=datetime(2026, 4, 15, 13, 0, tzinfo=timezone.utc),
            )

        self.assertEqual(result, {"checked": 1, "notifications_sent": 1})
        send_notification.assert_called_once_with(
            recipient_user_id="customer-user-1",
            provider_name="Kai Styles",
            service_name="Haircut",
            appointment_date="2026-04-15",
            appointment_time="15:00-15:30",
            reminder_type="two_hours_before",
        )
        booking_doc.reference.update.assert_called_once_with(
            {"reminder_two_hours_sent_at": sent_at}
        )


if __name__ == "__main__":
    unittest.main()
