from datetime import datetime, timezone
from typing import List, Optional
from firebase_admin import firestore
from firebase_db import get_database
from services.profanity_filter import sanitize_message
from services.datetime_utils import normalize_utc_datetime, utc_now

UNKNOWN_CUSTOMER = "Unknown Customer"
UNKNOWN_PROVIDER = "Unknown Provider"


def _first_or_none(docs):
    return docs[0] if docs else None


def _resolve_customer_context(db, customer_id: str) -> dict:
    """Resolve a customer reference that may be a profile id or user id."""
    if not customer_id:
        return {"user_id": "", "profile_id": None, "name": UNKNOWN_CUSTOMER}

    customer_doc = db.collection("customers").document(customer_id).get()
    if customer_doc.exists:
        customer_data = customer_doc.to_dict() or {}
        return {
            "user_id": customer_data.get("user_id") or customer_id,
            "profile_id": customer_doc.id,
            "name": customer_data.get("name") or UNKNOWN_CUSTOMER,
        }

    customer_doc = _first_or_none(
        db.collection("customers").where("user_id", "==", customer_id).limit(1).get()
    )
    if customer_doc:
        customer_data = customer_doc.to_dict() or {}
        return {
            "user_id": customer_data.get("user_id") or customer_id,
            "profile_id": customer_doc.id,
            "name": customer_data.get("name") or UNKNOWN_CUSTOMER,
        }

    return {"user_id": customer_id, "profile_id": None, "name": UNKNOWN_CUSTOMER}


def _resolve_provider_context(db, provider_id: str) -> dict:
    """Resolve a provider reference that may be a profile id or user id."""
    if not provider_id:
        return {"user_id": "", "profile_id": None, "name": UNKNOWN_PROVIDER}

    provider_doc = db.collection("providers").document(provider_id).get()
    if provider_doc.exists:
        provider_data = provider_doc.to_dict() or {}
        return {
            "user_id": provider_data.get("user_id") or provider_id,
            "profile_id": provider_doc.id,
            "name": provider_data.get("provider_name") or UNKNOWN_PROVIDER,
        }

    provider_doc = _first_or_none(
        db.collection("providers").where("user_id", "==", provider_id).limit(1).get()
    )
    if provider_doc:
        provider_data = provider_doc.to_dict() or {}
        return {
            "user_id": provider_data.get("user_id") or provider_id,
            "profile_id": provider_doc.id,
            "name": provider_data.get("provider_name") or UNKNOWN_PROVIDER,
        }

    return {"user_id": provider_id, "profile_id": None, "name": UNKNOWN_PROVIDER}


def _get_lookup_keys(context: dict, fallback_id: str) -> list[str]:
    keys = []
    for value in (fallback_id, context.get("user_id"), context.get("profile_id")):
        if value and value not in keys:
            keys.append(value)
    return keys


def _normalize_conversation(db, conversation_id: str, data: dict) -> dict:
    """Normalize stored participant ids to user ids and backfill display names."""
    customer_context = _resolve_customer_context(db, data.get("customer_id", ""))
    provider_context = _resolve_provider_context(db, data.get("provider_id", ""))

    normalized = dict(data)
    normalized["customer_id"] = customer_context["user_id"] or data.get("customer_id", "")
    normalized["provider_id"] = provider_context["user_id"] or data.get("provider_id", "")
    normalized["customer_name"] = (
        customer_context["name"]
        if customer_context["name"] != UNKNOWN_CUSTOMER
        else data.get("customer_name") or UNKNOWN_CUSTOMER
    )
    normalized["provider_name"] = (
        provider_context["name"]
        if provider_context["name"] != UNKNOWN_PROVIDER
        else data.get("provider_name") or UNKNOWN_PROVIDER
    )

    updates = {}
    for field in ("customer_id", "provider_id", "customer_name", "provider_name"):
        if normalized.get(field) != data.get(field):
            updates[field] = normalized.get(field)

    if updates:
        db.collection("conversations").document(conversation_id).set(updates, merge=True)

    return normalized


def _find_existing_conversation(conversations_ref, customer_keys: list[str], provider_keys: list[str]):
    provider_key_set = set(provider_keys)

    for customer_key in customer_keys:
        for doc in conversations_ref.where("customer_id", "==", customer_key).stream():
            conversation_data = doc.to_dict() or {}
            if conversation_data.get("provider_id") in provider_key_set:
                return doc

    return None



def _get_customer_name(db, customer_id: str) -> str:
    """Fetch customer name from database."""
    try:
        return _resolve_customer_context(db, customer_id)["name"]
    except Exception:
        return UNKNOWN_CUSTOMER


def _get_provider_name(db, provider_id: str) -> str:
    """Fetch provider name from database."""
    try:
        return _resolve_provider_context(db, provider_id)["name"]
    except Exception:
        return UNKNOWN_PROVIDER


#  CONVERSATION OPERATIONS

def get_or_create_conversation(customer_id: str, provider_id: str) -> str:
    """
    Get existing conversation or create new one.
    Returns conversation_id.
    
    """
    db = get_database()
    conversations_ref = db.collection('conversations')

    customer_context = _resolve_customer_context(db, customer_id)
    provider_context = _resolve_provider_context(db, provider_id)

    if not customer_context["user_id"]:
        raise ValueError("Customer not found")
    if not provider_context["user_id"]:
        raise ValueError("Provider not found")

    existing_doc = _find_existing_conversation(
        conversations_ref,
        _get_lookup_keys(customer_context, customer_id),
        _get_lookup_keys(provider_context, provider_id),
    )

    if existing_doc:
        _normalize_conversation(db, existing_doc.id, existing_doc.to_dict() or {})
        return existing_doc.id
    
    # Create new conversation
    conversation_data = {
        'customer_id': customer_context["user_id"],
        'provider_id': provider_context["user_id"],
        'customer_name': customer_context["name"],
        'provider_name': provider_context["name"],
        'created_at': utc_now(),
        'updated_at': utc_now(),
        'last_message': None,
        'last_message_time': None,
    }
    
    _, doc_ref = conversations_ref.add(conversation_data)
    return doc_ref.id


def get_user_conversations(user_id: str, role: str) -> List[dict]:
    """
    Get all conversations for a user.
    Returns list of conversation objects sorted by most recent
    """
    
    db = get_database()
    conversations_ref = db.collection('conversations')

    if role == "Customer":
        lookup_keys = _get_lookup_keys(_resolve_customer_context(db, user_id), user_id)
        participant_field = "customer_id"
    else:
        lookup_keys = _get_lookup_keys(_resolve_provider_context(db, user_id), user_id)
        participant_field = "provider_id"

    conversations = []
    seen_conversation_ids = set()
    for lookup_key in lookup_keys:
        query = conversations_ref.where(participant_field, '==', lookup_key)
        for doc in query.stream():
            if doc.id in seen_conversation_ids:
                continue

            seen_conversation_ids.add(doc.id)
            data = _normalize_conversation(db, doc.id, doc.to_dict() or {})
            data['id'] = doc.id

            if role == "Customer":
                data['unread_count'] = data.get('customer_unread_count', 0)
            else:
                data['unread_count'] = data.get('provider_unread_count', 0)

            conversations.append(data)
    
    # Sort by updated_at in Python (most recent first)
    fallback_timestamp = datetime.min.replace(tzinfo=timezone.utc)
    conversations.sort(
        key=lambda x: normalize_utc_datetime(x.get('updated_at')) or fallback_timestamp,
        reverse=True
    )
    
    return conversations


def get_conversation_by_id(conversation_id: str, user_role: str = None) -> Optional[dict]:
    """
    Get a specific conversation by ID.
    Returns conversation data or None if not found
    """
    
    db = get_database()
    conv_ref = db.collection('conversations').document(conversation_id)
    conv_doc = conv_ref.get()
    
    if not conv_doc.exists:
        return None
    
    data = _normalize_conversation(db, conv_doc.id, conv_doc.to_dict() or {})
    data['id'] = conv_doc.id
    
    # Calculate unified unread_count if role is provided
    if user_role:
        if user_role == "Customer":
            data['unread_count'] = data.get('customer_unread_count', 0)
        else:
            data['unread_count'] = data.get('provider_unread_count', 0)
    
    return data


def verify_user_in_conversation(conversation_id: str, user_id: str, role: str) -> bool:
    """
    Verify that a user is a participant in a conversation.
    Returns True if user is a participant, False otherwise
    """
    
    conversation = get_conversation_by_id(conversation_id)
    
    if not conversation:
        return False

    normalized_role = role.value if hasattr(role, "value") else str(role)
    if "." in normalized_role:
        normalized_role = normalized_role.split(".")[-1]

    db = get_database()

    if normalized_role == "Customer":
        allowed_customer_ids = set(
            _get_lookup_keys(_resolve_customer_context(db, user_id), user_id)
        )
        return conversation.get('customer_id') in allowed_customer_ids
    else:  # Provider
        allowed_provider_ids = set(
            _get_lookup_keys(_resolve_provider_context(db, user_id), user_id)
        )
        return conversation.get('provider_id') in allowed_provider_ids



#  MESSAGE OPERATIONS

def send_message(
    conversation_id: str,
    sender_id: str,
    sender_role: str,
    content: str,
    message_type: str = "text",
    image_url: Optional[str] = None
) -> str:
    
    """
    Send a message in a conversation.
    """
    
    db = get_database()
    
    # Verify conversation exists
    conv_ref = db.collection('conversations').document(conversation_id)
    conv_data = conv_ref.get().to_dict()
    
    if not conv_data:
        raise ValueError("Conversation not found")
    
    # Filter profanity from message content (non-blocking - sanitizes, doesn't reject)
    print(f"[PROFANITY_FILTER] Original content: {content}")
    filtered_content = sanitize_message(content)
    print(f"[PROFANITY_FILTER] Filtered content: {filtered_content}")
    
    # Create message
    created_at = utc_now()
    message_data = {
        'conversation_id': conversation_id,
        'sender_id': sender_id,
        'sender_role': sender_role,
        'content': filtered_content,
        'message_type': message_type,
        'image_url': image_url,
        'thumbnail_url': None,  # Can be added later for image optimization
        'created_at': created_at,
        'read': False,
        'status': 'sent',
    }
    
    messages_ref = db.collection('messages')
    _, doc_ref = messages_ref.add(message_data)
    message_id = doc_ref.id
    
    # Also write to conversation subcollection for Firebase real-time listening
    try:
        subcollection_ref = db.collection('conversations').document(conversation_id).collection('messages')
        subcollection_ref.document(message_id).set(message_data)
    except Exception as e:
        print(f"Warning: Failed to write to conversation subcollection: {e}")
    
    # Update conversation metadata with full last_message object
    last_message_obj = {
        'id': message_id,
        'sender_id': sender_id,
        'sender_role': sender_role,
        'content': filtered_content,  # Use filtered content, not original
        'message_type': message_type,
        'image_url': image_url,
        'created_at': created_at,
    }
    
    update_data = {
        'updated_at': created_at,
        'last_message': last_message_obj,
        'last_message_time': created_at,
    }
    
    # Increment unread count for the recipient
    if sender_role == "Customer":
        update_data['provider_unread_count'] = firestore.Increment(1)
    else:
        update_data['customer_unread_count'] = firestore.Increment(1)
    
    conv_ref.update(update_data)
    
    print(f"[PROFANITY_FILTER] Returning message_id: {message_id}, filtered_content: {filtered_content}")
    return message_id, filtered_content


def get_conversation_messages(
    conversation_id: str,
    limit: int = 50,
    before_timestamp: Optional[datetime] = None
) -> List[dict]:
    """
    Get messages in a conversation 
    """
    db = get_database()
    messages_ref = db.collection('messages')
    
    query = messages_ref.where('conversation_id', '==', conversation_id)\
                        .order_by('created_at', direction=firestore.Query.DESCENDING)\
                        .limit(limit)
    
    # Pagination support
    if before_timestamp:
        query = query.where('created_at', '<', before_timestamp)
    
    messages = []
    for doc in query.stream():
        data = doc.to_dict()
        data['id'] = doc.id
        messages.append(data)
    
    return messages


def mark_conversation_as_read(conversation_id: str, user_role: str) -> bool:
    """
    Mark all messages in a conversation as read for the user
    and reset their unread counter to 0.
    
    Args:
        conversation_id: ID of the conversation
        user_role: Role of the user ("Customer" or "Provider")
    
    Returns:
        True if successful, False otherwise
    """
    db = get_database()
    
    try:
        conv_ref = db.collection('conversations').document(conversation_id)
        
        # Reset the appropriate unread counter based on user role
        update_data = {}
        if user_role == "Customer":
            update_data['customer_unread_count'] = 0
        else:
            update_data['provider_unread_count'] = 0
        
        conv_ref.update(update_data)
        
        # Mark unread messages from the other party as read
        messages_ref = db.collection('messages')
        
        # Determine sender role of messages to mark as read
        sender_role_to_mark = "Provider" if user_role == "Customer" else "Customer"
        
        # Query for unread messages from the other party
        unread_query = messages_ref.where('conversation_id', '==', conversation_id)\
                                   .where('sender_role', '==', sender_role_to_mark)\
                                   .where('read', '==', False)
        
        # Batch update to mark messages as read
        batch = db.batch()
        unread_docs = unread_query.stream()
        
        for doc in unread_docs:
            doc_ref = messages_ref.document(doc.id)
            batch.update(doc_ref, {'read': True, 'status': 'read'})
            print(f"[DEBUG] Marking message {doc.id} as read in main collection")
        
        batch.commit()
        
        # Also update the conversation subcollection (used by Firebase real-time subscription)
        subcollection_ref = db.collection('conversations').document(conversation_id).collection('messages')
        subcollection_query = subcollection_ref.where('sender_role', '==', sender_role_to_mark).where('read', '==', False)
        
        batch2 = db.batch()
        for doc in subcollection_query.stream():
            doc_ref = subcollection_ref.document(doc.id)
            batch2.update(doc_ref, {'read': True, 'status': 'read'})
            print(f"[DEBUG] Marking message {doc.id} as read in subcollection")
        
        batch2.commit()
        
        return True
    except Exception as e:
        print(f"Error marking conversation as read: {e}")
        return False


def mark_message_as_read(conversation_id: str, message_id: str, user_role: str) -> bool:
    """
    Mark a single message as read for the user.
    
    Args:
        conversation_id: ID of the conversation
        message_id: ID of the message to mark as read
        user_role: Role of the user ("Customer" or "Provider")
    
    Returns:
        True if successful, False otherwise
    """
    db = get_database()
    
    try:
        # Determine sender role to check (the message should be from the other party)
        sender_role_to_check = "Provider" if user_role == "Customer" else "Customer"
        
        # Update in main messages collection
        main_msg_ref = db.collection('messages').document(message_id)
        main_doc = main_msg_ref.get()
        
        if main_doc.exists:
            main_data = main_doc.to_dict()
            if main_data.get('sender_role') == sender_role_to_check and not main_data.get('read', False):
                main_msg_ref.update({'read': True, 'status': 'read'})
                print(f"[DEBUG] Marking message {message_id} as read in main collection")
        
        # Update in conversation subcollection
        sub_msg_ref = db.collection('conversations').document(conversation_id).collection('messages').document(message_id)
        sub_doc = sub_msg_ref.get()
        
        if sub_doc.exists:
            sub_data = sub_doc.to_dict()
            if sub_data.get('sender_role') == sender_role_to_check and not sub_data.get('read', False):
                sub_msg_ref.update({'read': True, 'status': 'read'})
                print(f"[DEBUG] Marking message {message_id} as read in subcollection")
        
        return True
    except Exception as e:
        print(f"Error marking message as read: {e}")
        return False
