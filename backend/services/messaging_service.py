from datetime import datetime
from typing import List, Optional
from firebase_admin import firestore
from firebase_db import get_database
from services.profanity_filter import sanitize_message



def _get_customer_name(db, customer_id: str) -> str:
    """Fetch customer name from database."""
    try:
        # Query by user_id field since customer_id is the user_id
        customer_docs = db.collection('customers').where('user_id', '==', customer_id).limit(1).get()
        if customer_docs:
            customer_data = customer_docs[0].to_dict()
            return customer_data.get('name', 'Unknown Customer')
        return 'Unknown Customer'
    except Exception:
        return 'Unknown Customer'


def _get_provider_name(db, provider_id: str) -> str:
    """Fetch provider name from database."""
    try:
        # Query by user_id field since provider_id is the user_id
        provider_docs = db.collection('providers').where('user_id', '==', provider_id).limit(1).get()
        if provider_docs:
            provider_data = provider_docs[0].to_dict()
            return provider_data.get('provider_name', 'Unknown Provider')
        return 'Unknown Provider'
    except Exception:
        return 'Unknown Provider'


#  CONVERSATION OPERATIONS

def get_or_create_conversation(customer_id: str, provider_id: str) -> str:
    """
    Get existing conversation or create new one.
    Returns conversation_id.
    
    """
    db = get_database()
    conversations_ref = db.collection('conversations')
    
    # Check if conversation exists
    query = conversations_ref.where('customer_id', '==', customer_id)\
                             .where('provider_id', '==', provider_id)\
                             .limit(1)
    
    docs = list(query.stream())
    
    if docs:
        return docs[0].id
    
    # Fetch names for both participants
    customer_name = _get_customer_name(db, customer_id)
    provider_name = _get_provider_name(db, provider_id)
    
    # Create new conversation
    conversation_data = {
        'customer_id': customer_id,
        'provider_id': provider_id,
        'customer_name': customer_name,
        'provider_name': provider_name,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
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
    
    # Query by user role only (no composite index needed)
    if role == "Customer":
        query = conversations_ref.where('customer_id', '==', user_id)
    else:
        query = conversations_ref.where('provider_id', '==', user_id)
    
    # Fetch all results and sort in Python to avoid composite index requirement
    conversations = []
    for doc in query.stream():
        data = doc.to_dict()
        data['id'] = doc.id
        
        # Enrich with names if missing (for existing conversations)
        if not data.get('customer_name'):
            data['customer_name'] = _get_customer_name(db, data.get('customer_id', ''))
        if not data.get('provider_name'):
            data['provider_name'] = _get_provider_name(db, data.get('provider_id', ''))
        
        # Calculate unified unread_count based on user's role
        if role == "Customer":
            data['unread_count'] = data.get('customer_unread_count', 0)
        else:
            data['unread_count'] = data.get('provider_unread_count', 0)
        
        conversations.append(data)
    
    # Sort by updated_at in Python (most recent first)
    conversations.sort(
        key=lambda x: x.get('updated_at') or datetime.min,
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
    
    data = conv_doc.to_dict()
    data['id'] = conv_doc.id
    
    # Enrich with names if missing (for existing conversations)
    if not data.get('customer_name'):
        data['customer_name'] = _get_customer_name(db, data.get('customer_id', ''))
    if not data.get('provider_name'):
        data['provider_name'] = _get_provider_name(db, data.get('provider_id', ''))
    
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
    
    if role == "Customer":
        return conversation.get('customer_id') == user_id
    else:  # Provider
        return conversation.get('provider_id') == user_id



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
    created_at = datetime.utcnow()
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