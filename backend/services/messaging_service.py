from datetime import datetime
from typing import List, Optional
from firebase_admin import firestore
from firebase_db import get_database



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
        
        conversations.append(data)
    
    # Sort by updated_at in Python (most recent first)
    conversations.sort(
        key=lambda x: x.get('updated_at') or datetime.min,
        reverse=True
    )
    
    return conversations


def get_conversation_by_id(conversation_id: str) -> Optional[dict]: 
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
    
    # Create message
    message_data = {
        'conversation_id': conversation_id,
        'sender_id': sender_id,
        'sender_role': sender_role,
        'content': content,
        'message_type': message_type,
        'image_url': image_url,
        'thumbnail_url': None,  # Can be added later for image optimization
        'created_at': datetime.utcnow(),
    }
    
    messages_ref = db.collection('messages')
    _, doc_ref = messages_ref.add(message_data)
    message_id = doc_ref.id
    
    # Update conversation metadata
    update_data = {
        'updated_at': datetime.utcnow(),
        'last_message': content[:50],  # Preview (first 50 chars)
        'last_message_time': datetime.utcnow(),
    }
    
    conv_ref.update(update_data)
    
    return message_id


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