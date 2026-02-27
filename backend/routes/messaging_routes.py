from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
import logging

from models import (
    User, UserRole, Conversation, Message, SendMessageRequest
)
from services.messaging_service import (
    get_or_create_conversation,
    get_user_conversations,
    send_message,
    get_conversation_messages,
    verify_user_in_conversation,
)


from auth import get_current_user

log = logging.getLogger("skedulelt.messaging")

router = APIRouter(prefix="/api/messaging", tags=["messaging"])


# CONVERSATION ENDPOINTS

@router.get("/conversations", response_model=List[Conversation])
async def list_conversations(current_user: User = Depends(get_current_user)):
    """
    Get all conversations for the current user.
    Returns conversations sorted by most recent activity.
    """
    try:
        conversations = get_user_conversations(
            user_id=current_user.id,
            role=current_user.role
        )
        
        log.info(f"User {current_user.id} ({current_user.role}) retrieved {len(conversations)} conversations")
        
        return conversations
    
    except Exception as e:
        log.error(f"Error fetching conversations: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch conversations: {str(e)}"
        )


@router.post("/conversations/start", response_model=dict)
async def start_conversation(recipient_id: str, current_user: User = Depends(get_current_user)):
    """
    Start a conversation with another user.
    
    - Customers can start conversations with providers
    - Providers can start conversations with customers
    
    Returns conversation_id (creates new conversation or returns existing one)
    """
    try:
        if current_user.role == UserRole.CUSTOMER:
            customer_id = current_user.id
            provider_id = recipient_id
        else:  # Provider
            customer_id = recipient_id
            provider_id = current_user.id
        
        conversation_id = get_or_create_conversation(
            customer_id=customer_id,
            provider_id=provider_id
        )
        
        log.info(f"User {current_user.id} started/retrieved conversation {conversation_id}")
        
        return {"conversation_id": conversation_id}
    
    except Exception as e:
        log.error(f"Error creating conversation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create conversation: {str(e)}"
        )       