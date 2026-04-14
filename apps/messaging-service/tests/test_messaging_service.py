import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import messaging_service


class MessagingServiceTests(unittest.TestCase):
    def test_get_or_create_conversation_returns_existing_id(self):
        existing_doc = MagicMock()
        existing_doc.id = "conv-existing"
        existing_doc.to_dict.return_value = {
            "customer_id": "customer-1",
            "provider_id": "provider-1",
            "customer_name": "Ava Customer",
            "provider_name": "Kai Provider",
        }

        missing_doc = MagicMock()
        missing_doc.exists = False

        customer_profile_doc = MagicMock()
        customer_profile_doc.id = "customer-profile-1"
        customer_profile_doc.to_dict.return_value = {
            "user_id": "customer-1",
            "name": "Ava Customer",
        }

        provider_profile_doc = MagicMock()
        provider_profile_doc.id = "provider-profile-1"
        provider_profile_doc.to_dict.return_value = {
            "user_id": "provider-1",
            "provider_name": "Kai Provider",
        }

        query = MagicMock()
        query.stream.return_value = [existing_doc]

        conversations_ref = MagicMock()
        conversations_ref.where.return_value = query

        customers_query = MagicMock()
        customers_query.limit.return_value = customers_query
        customers_query.get.return_value = [customer_profile_doc]
        customers_collection = MagicMock()
        customers_collection.where.return_value = customers_query
        customers_collection.document.return_value = SimpleNamespace(get=lambda: missing_doc)

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = [provider_profile_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query
        providers_collection.document.return_value = SimpleNamespace(get=lambda: missing_doc)

        db = MagicMock()

        def collection_side_effect(name):
            if name == "conversations":
                return conversations_ref
            if name == "customers":
                return customers_collection
            if name == "providers":
                return providers_collection
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with patch.object(messaging_service, "get_database", return_value=db):
            conversation_id = messaging_service.get_or_create_conversation(
                "customer-1",
                "provider-1",
            )

        self.assertEqual(conversation_id, "conv-existing")
        conversations_ref.add.assert_not_called()

    def test_get_or_create_conversation_accepts_provider_profile_id(self):
        customer_profile_doc = MagicMock()
        customer_profile_doc.id = "customer-profile-1"
        customer_profile_doc.to_dict.return_value = {
            "user_id": "customer-user-1",
            "name": "Ava Customer",
        }

        missing_customer_doc = MagicMock()
        missing_customer_doc.exists = False

        provider_profile_doc = MagicMock()
        provider_profile_doc.id = "provider-profile-1"
        provider_profile_doc.exists = True
        provider_profile_doc.to_dict.return_value = {
            "user_id": "provider-user-1",
            "provider_name": "Kai Provider",
        }

        missing_provider_doc = MagicMock()
        missing_provider_doc.exists = False

        customers_query = MagicMock()
        customers_query.limit.return_value = customers_query
        customers_query.get.return_value = [customer_profile_doc]
        customers_collection = MagicMock()
        customers_collection.where.return_value = customers_query
        customers_collection.document.side_effect = lambda doc_id: SimpleNamespace(
            get=lambda: customer_profile_doc if doc_id == "customer-profile-1" else missing_customer_doc
        )

        providers_query = MagicMock()
        providers_query.limit.return_value = providers_query
        providers_query.get.return_value = []
        providers_collection = MagicMock()
        providers_collection.where.return_value = providers_query
        providers_collection.document.side_effect = lambda doc_id: SimpleNamespace(
            get=lambda: provider_profile_doc if doc_id == "provider-profile-1" else missing_provider_doc
        )

        conversation_query = MagicMock()
        conversation_query.stream.return_value = []
        conversations_collection = MagicMock()
        conversations_collection.where.return_value = conversation_query
        conversations_collection.add.return_value = (None, SimpleNamespace(id="conv-new"))

        db = MagicMock()

        def collection_side_effect(name):
            if name == "customers":
                return customers_collection
            if name == "providers":
                return providers_collection
            if name == "conversations":
                return conversations_collection
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with (
            patch.object(messaging_service, "get_database", return_value=db),
            patch.object(
                messaging_service,
                "utc_now",
                return_value=datetime(2026, 4, 14, tzinfo=timezone.utc),
            ),
        ):
            conversation_id = messaging_service.get_or_create_conversation(
                "customer-user-1",
                "provider-profile-1",
            )

        self.assertEqual(conversation_id, "conv-new")
        conversations_collection.add.assert_called_once()
        created_conversation = conversations_collection.add.call_args.args[0]
        self.assertEqual(created_conversation["customer_id"], "customer-user-1")
        self.assertEqual(created_conversation["provider_id"], "provider-user-1")
        self.assertEqual(created_conversation["customer_name"], "Ava Customer")
        self.assertEqual(created_conversation["provider_name"], "Kai Provider")

    def test_get_user_conversations_includes_and_repairs_legacy_provider_profile_ids(self):
        updated_at = datetime(2026, 4, 14, tzinfo=timezone.utc)

        provider_profile_doc = MagicMock()
        provider_profile_doc.id = "provider-profile-1"
        provider_profile_doc.to_dict.return_value = {
            "user_id": "provider-user-1",
            "provider_name": "Kai Provider",
        }

        customer_profile_doc = MagicMock()
        customer_profile_doc.id = "customer-profile-1"
        customer_profile_doc.to_dict.return_value = {
            "user_id": "customer-user-1",
            "name": "Ava Customer",
        }

        missing_doc = MagicMock()
        missing_doc.exists = False

        provider_lookup_query = MagicMock()
        provider_lookup_query.limit.return_value = provider_lookup_query
        provider_lookup_query.get.return_value = [provider_profile_doc]
        providers_collection = MagicMock()
        providers_collection.where.return_value = provider_lookup_query
        providers_collection.document.side_effect = lambda doc_id: SimpleNamespace(
            get=lambda: provider_profile_doc if doc_id == "provider-profile-1" else missing_doc
        )

        customer_lookup_query = MagicMock()
        customer_lookup_query.limit.return_value = customer_lookup_query
        customer_lookup_query.get.return_value = [customer_profile_doc]
        customers_collection = MagicMock()
        customers_collection.where.return_value = customer_lookup_query
        customers_collection.document.side_effect = lambda doc_id: SimpleNamespace(
            get=lambda: customer_profile_doc if doc_id == "customer-profile-1" else missing_doc
        )

        legacy_conversation_doc = MagicMock()
        legacy_conversation_doc.id = "conv-legacy"
        legacy_conversation_doc.to_dict.return_value = {
            "customer_id": "customer-user-1",
            "provider_id": "provider-profile-1",
            "updated_at": updated_at,
            "provider_unread_count": 2,
        }

        provider_user_query = MagicMock()
        provider_user_query.stream.return_value = []
        provider_profile_query = MagicMock()
        provider_profile_query.stream.return_value = [legacy_conversation_doc]
        conversations_collection = MagicMock()

        def conversations_where_side_effect(field, op, value):
            if field != "provider_id" or op != "==":
                raise AssertionError(f"Unexpected conversation lookup: {(field, op, value)}")
            if value == "provider-user-1":
                return provider_user_query
            if value == "provider-profile-1":
                return provider_profile_query
            raise AssertionError(f"Unexpected provider conversation key: {value}")

        conversations_collection.where.side_effect = conversations_where_side_effect
        conversation_ref = MagicMock()
        conversations_collection.document.return_value = conversation_ref

        db = MagicMock()

        def collection_side_effect(name):
            if name == "providers":
                return providers_collection
            if name == "customers":
                return customers_collection
            if name == "conversations":
                return conversations_collection
            raise AssertionError(f"Unexpected collection: {name}")

        db.collection.side_effect = collection_side_effect

        with patch.object(messaging_service, "get_database", return_value=db):
            conversations = messaging_service.get_user_conversations(
                "provider-user-1",
                "Provider",
            )

        self.assertEqual(len(conversations), 1)
        self.assertEqual(conversations[0]["id"], "conv-legacy")
        self.assertEqual(conversations[0]["provider_id"], "provider-user-1")
        self.assertEqual(conversations[0]["provider_name"], "Kai Provider")
        self.assertEqual(conversations[0]["customer_name"], "Ava Customer")
        self.assertEqual(conversations[0]["unread_count"], 2)
        conversation_ref.set.assert_called_once_with(
            {
                "provider_id": "provider-user-1",
                "customer_name": "Ava Customer",
                "provider_name": "Kai Provider",
            },
            merge=True,
        )

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
