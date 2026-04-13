import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from services import notification_service


class _FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return b'{"data":[{"status":"ok"}]}'


class NotificationServiceTests(unittest.TestCase):
    def test_send_booking_rescheduled_notification_builds_expected_expo_payload(
        self,
    ):
        with (
            patch.object(
                notification_service,
                "get_user_push_tokens",
                return_value=["ExponentPushToken[test-token]"],
            ),
            patch.object(
                notification_service.urllib_request,
                "urlopen",
                return_value=_FakeResponse(),
            ) as mock_urlopen,
        ):
            notification_service.send_booking_rescheduled_notification(
                recipient_user_id="customer-user-1",
                provider_name="Kai Styles",
                service_name="Haircut",
                old_date="2026-04-13",
                new_date="2026-04-14",
                old_time="09:00-09:30",
                new_time="10:00-10:30",
            )

        request = mock_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))

        self.assertEqual(payload["to"], ["ExponentPushToken[test-token]"])
        self.assertEqual(payload["title"], "Appointment rescheduled")
        self.assertEqual(
            payload["body"],
            "Haircut with Kai Styles moved to Apr 14, 2026 at 10:00 AM-10:30 AM.",
        )
        self.assertEqual(payload["channelId"], "appointments")
        self.assertEqual(payload["data"]["type"], "booking_rescheduled")
        self.assertEqual(payload["data"]["providerName"], "Kai Styles")
        self.assertEqual(payload["data"]["serviceName"], "Haircut")
        self.assertEqual(payload["data"]["oldDate"], "2026-04-13")
        self.assertEqual(payload["data"]["oldDateLabel"], "Apr 13, 2026")
        self.assertEqual(payload["data"]["newDate"], "2026-04-14")
        self.assertEqual(payload["data"]["newDateLabel"], "Apr 14, 2026")
        self.assertEqual(payload["data"]["oldTime"], "09:00-09:30")
        self.assertEqual(payload["data"]["oldTimeLabel"], "9:00 AM-9:30 AM")
        self.assertEqual(payload["data"]["newTime"], "10:00-10:30")
        self.assertEqual(payload["data"]["newTimeLabel"], "10:00 AM-10:30 AM")

    def test_send_booking_reminder_notification_builds_expected_expo_payload(self):
        with (
            patch.object(
                notification_service,
                "get_user_push_tokens",
                return_value=["ExponentPushToken[test-token]"],
            ),
            patch.object(
                notification_service.urllib_request,
                "urlopen",
                return_value=_FakeResponse(),
            ) as mock_urlopen,
        ):
            notification_service.send_booking_reminder_notification(
                recipient_user_id="customer-user-1",
                provider_name="Kai Styles",
                service_name="Haircut",
                appointment_date="2026-04-14",
                appointment_time="10:00-10:30",
                reminder_type="two_hours_before",
            )

        request = mock_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))

        self.assertEqual(payload["to"], ["ExponentPushToken[test-token]"])
        self.assertEqual(payload["title"], "Appointment in 2 hours")
        self.assertEqual(
            payload["body"],
            "Haircut with Kai Styles starts in 2 hours at 10:00 AM-10:30 AM.",
        )
        self.assertEqual(payload["channelId"], "appointments")
        self.assertEqual(payload["data"]["type"], "booking_reminder")
        self.assertEqual(payload["data"]["providerName"], "Kai Styles")
        self.assertEqual(payload["data"]["serviceName"], "Haircut")
        self.assertEqual(payload["data"]["appointmentDate"], "2026-04-14")
        self.assertEqual(payload["data"]["appointmentDateLabel"], "Apr 14, 2026")
        self.assertEqual(payload["data"]["appointmentTime"], "10:00-10:30")
        self.assertEqual(
            payload["data"]["appointmentTimeLabel"],
            "10:00 AM-10:30 AM",
        )
        self.assertEqual(payload["data"]["reminderType"], "two_hours_before")


if __name__ == "__main__":
    unittest.main()
