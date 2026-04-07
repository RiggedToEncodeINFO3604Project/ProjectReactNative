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
   
        
if __name__ == "__main__":
    unittest.main()