from datetime import datetime
from typing import List, Optional
from firebase_admin import firestore
from firebase_db import get_database



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
    
    # Create new conversation
    conversation_data = {
        'customer_id': customer_id,
        'provider_id': provider_id,
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
    
    if role == "Customer":
        query = conversations_ref.where('customer_id', '==', user_id)
    else:
        query = conversations_ref.where('provider_id', '==', user_id)
    
    # Sort by most recent activity
    query = query.order_by('updated_at', direction=firestore.Query.DESCENDING)
    
    conversations = []
    for doc in query.stream():
        data = doc.to_dict()
        data['_id'] = doc.id
        conversations.append(data)
    
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
    data['_id'] = conv_doc.id
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