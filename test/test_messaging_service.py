import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import messaging_service


class MessagingServiceTests(unittest.TestCase):
    def test_get_or_create_conversation_returns_existing_id(self):
        existing_doc = MagicMock()
        existing_doc.id = "conv-existing"

        query = MagicMock()
        query.where.return_value = query
        query.limit.return_value = query
        query.stream.return_value = [existing_doc]

        conversations_ref = MagicMock()
        conversations_ref.where.return_value = query

        db = MagicMock()
        db.collection.return_value = conversations_ref

        with patch.object(messaging_service, "get_database", return_value=db):
            conversation_id = messaging_service.get_or_create_conversation(
                "customer-1",
                "provider-1",
            )

        self.assertEqual(conversation_id, "conv-existing")
        conversations_ref.add.assert_not_called()

    def test_send_message_sanitizes_content_and_updates_metadata(self):
        created_at = datetime(2026, 4, 7, tzinfo=timezone.utc)

        conv_snapshot = MagicMock()
        conv_snapshot.to_dict.return_value = {
            "customer_id": "customer-1",
            "provider_id": "provider-1",
        }

        conv_ref = MagicMock()
        conv_ref.get.return_value = conv_snapshot
        conv_ref.collection.return_value = None

        subcollection_doc_ref = MagicMock()
        subcollection_ref = MagicMock()
        subcollection_ref.document.return_value = subcollection_doc_ref
        conv_ref.collection.return_value = subcollection_ref

        message_doc_ref = SimpleNamespace(id="message-123")
        messages_ref = MagicMock()
        messages_ref.add.return_value = (None, message_doc_ref)

        conversations_collection = MagicMock()
        conversations_collection.document.return_value = conv_ref

        db = MagicMock()


if __name__ == "__main__":
    unittest.main()
