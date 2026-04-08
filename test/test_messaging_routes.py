import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from models import UserInDB, UserRole
from routes import messaging_routes

class MessagingRoutesTests(unittest.TestCase):
    def setUp(self):
        self.user = UserInDB(
            _id="customer-1",
            email="customer@example.com",
            role=UserRole.CUSTOMER,
            password="hashed-password",
            created_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
        )

        app = FastAPI()
        app.include_router(
            messaging_routes.router,
            prefix="/api/messaging",
            tags=["messaging"],
        )
        app.dependency_overrides[messaging_routes.get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_get_messages_returns_403_for_non_participant(self):
        with patch.object(
            messaging_routes,
            "verify_user_in_conversation",
            return_value=False,
        ):
            response = self.client.get("/api/messaging/conversations/conv-1/messages")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "You are not a participant in this conversation",
        )

    def test_send_message_broadcasts_and_notifies_offline_recipient(self):
        with (
            patch.object(
                messaging_routes,
                "verify_user_in_conversation",
                return_value=True,
            ),
            patch.object(
                messaging_routes,
                "send_message",
                return_value=("message-1", "filtered hello"),
            ) as send_message_mock,
            patch.object(
                messaging_routes,
                "get_conversation_by_id",
                return_value={
                    "provider_id": "provider-9",
                    "customer_name": "Ava Customer",
                    "provider_name": "Kai Provider",
                },
            ),
            patch.object(
                messaging_routes.websocket_manager,
                "broadcast_to_conversation",
                new=AsyncMock(),
            ) as broadcast_mock,
            patch.object(
                messaging_routes.websocket_manager,
                "is_user_online",
                return_value=False,
            ),
            patch.object(
                messaging_routes,
                "send_chat_push_notification",
            ) as push_mock,
        ):
            response = self.client.post(
                "/api/messaging/conversations/conv-1/messages",
                json={"content": "hello there", "message_type": "text"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"message_id": "message-1", "filtered_content": "filtered hello"},
        )

        send_message_mock.assert_called_once_with(
            conversation_id="conv-1",
            sender_id="customer-1",
            sender_role=UserRole.CUSTOMER,
            content="hello there",
            message_type="text",
            image_url=None,
        )
        broadcast_mock.assert_awaited_once()
        push_mock.assert_called_once_with(
            recipient_user_id="provider-9",
            sender_name="Ava Customer",
            conversation_id="conv-1",
            recipient_role=UserRole.PROVIDER.value,
            message_preview="filtered hello",
            message_type="text",
        )

    def test_send_image_message_allows_empty_content(self):
        with (
            patch.object(
                messaging_routes,
                "verify_user_in_conversation",
                return_value=True,
            ),
            patch.object(
                messaging_routes,
                "send_message",
                return_value=("message-image-1", ""),
            ) as send_message_mock,
            patch.object(
                messaging_routes,
                "get_conversation_by_id",
                return_value={
                    "provider_id": "provider-9",
                    "customer_name": "Ava Customer",
                    "provider_name": "Kai Provider",
                },
            ),
            patch.object(
                messaging_routes.websocket_manager,
                "broadcast_to_conversation",
                new=AsyncMock(),
            ),
            patch.object(
                messaging_routes.websocket_manager,
                "is_user_online",
                return_value=True,
            ),
            patch.object(
                messaging_routes,
                "send_chat_push_notification",
            ) as push_mock,
        ):
            response = self.client.post(
                "/api/messaging/conversations/conv-1/messages",
                json={
                    "content": "",
                    "message_type": "image",
                    "image_url": "https://example.com/image.jpg",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"message_id": "message-image-1", "filtered_content": ""},
        )
        send_message_mock.assert_called_once_with(
            conversation_id="conv-1",
            sender_id="customer-1",
            sender_role=UserRole.CUSTOMER,
            content="",
            message_type="image",
            image_url="https://example.com/image.jpg",
        )
        push_mock.assert_not_called()

    def test_mark_conversation_read_broadcasts_status_update(self):
        with (
            patch.object(
                messaging_routes,
                "verify_user_in_conversation",
                return_value=True,
            ),
            patch.object(
                messaging_routes,
                "mark_conversation_as_read",
                return_value=True,
            ),
            patch.object(
                messaging_routes.websocket_manager,
                "broadcast_message_read",
                new=AsyncMock(),
            ) as broadcast_mock,
        ):
            response = self.client.post("/api/messaging/conversations/conv-1/read")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"success": True, "message": "Conversation marked as read"},
        )
        broadcast_mock.assert_awaited_once_with(
            conversation_id="conv-1",
            user_role=UserRole.CUSTOMER,
        )
        
if __name__ == "__main__":
    unittest.main()
