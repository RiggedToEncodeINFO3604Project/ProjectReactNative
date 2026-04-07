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

        def collection_side_effect(name):
            if name == "conversations":
                return conversations_collection
            if name == "messages":
                return messages_ref
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with (
            patch.object(messaging_service, "get_database", return_value=db),
            patch.object(
                messaging_service,
                "sanitize_message",
                return_value="clean content",
            ),
            patch.object(messaging_service, "utc_now", return_value=created_at),
            patch.object(
                messaging_service.firestore,
                "Increment",
                side_effect=lambda value: ("increment", value),
            ),
        ):
            message_id, filtered_content = messaging_service.send_message(
                conversation_id="conversation-1",
                sender_id="customer-1",
                sender_role="Customer",
                content="dirty content",
            )

        self.assertEqual(message_id, "message-123")
        self.assertEqual(filtered_content, "clean content")

        messages_ref.add.assert_called_once()
        added_message = messages_ref.add.call_args.args[0]
        self.assertEqual(added_message["content"], "clean content")
        self.assertEqual(added_message["status"], "sent")
        self.assertFalse(added_message["read"])

        subcollection_doc_ref.set.assert_called_once()
        conv_ref.update.assert_called_once_with(
            {
                "updated_at": created_at,
                "last_message": {
                    "id": "message-123",
                    "sender_id": "customer-1",
                    "sender_role": "Customer",
                    "content": "clean content",
                    "message_type": "text",
                    "image_url": None,
                    "created_at": created_at,
                },
                "last_message_time": created_at,
                "provider_unread_count": ("increment", 1),
            }
        )

    def test_mark_conversation_as_read_resets_counter_and_marks_other_party_messages(self):
        conv_ref = MagicMock()

        main_batch = MagicMock()
        sub_batch = MagicMock()
        db = MagicMock()
        db.batch.side_effect = [main_batch, sub_batch]

        unread_main_doc = SimpleNamespace(id="msg-1")
        unread_sub_doc = SimpleNamespace(id="msg-1")

        messages_query = MagicMock()
        messages_query.where.return_value = messages_query
        messages_query.stream.return_value = [unread_main_doc]
        messages_collection = MagicMock()
        messages_collection.where.return_value = messages_query
        messages_collection.document.side_effect = lambda doc_id: f"main-doc:{doc_id}"

        subcollection_query = MagicMock()
        subcollection_query.where.return_value = subcollection_query
        subcollection_query.stream.return_value = [unread_sub_doc]
        subcollection_ref = MagicMock()
        subcollection_ref.where.return_value = subcollection_query
        subcollection_ref.document.side_effect = lambda doc_id: f"sub-doc:{doc_id}"
        conv_ref.collection.return_value = subcollection_ref

        conversations_collection = MagicMock()
        conversations_collection.document.return_value = conv_ref

        def collection_side_effect(name):
            if name == "conversations":
                return conversations_collection
            if name == "messages":
                return messages_collection
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with patch.object(messaging_service, "get_database", return_value=db):
            success = messaging_service.mark_conversation_as_read(
                "conversation-1",
                "Customer",
            )

        self.assertTrue(success)
        conv_ref.update.assert_called_once_with({"customer_unread_count": 0})
        main_batch.update.assert_called_once_with(
            "main-doc:msg-1",
            {"read": True, "status": "read"},
        )
        sub_batch.update.assert_called_once_with(
            "sub-doc:msg-1",
            {"read": True, "status": "read"},
        )
        main_batch.commit.assert_called_once()
        sub_batch.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
