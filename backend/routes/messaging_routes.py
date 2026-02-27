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
        

@router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    """
    Get details of a specific conversation
    User must be a participant in the conversation.
    """
    try:
        # Verify user is in this conversation
        if not verify_user_in_conversation(conversation_id, current_user.id, current_user.role):
            raise HTTPException(
                status_code=403,
                detail="You are not a participant in this conversation"
            )
        
        from services.messaging_service import get_conversation_by_id
        conversation = get_conversation_by_id(conversation_id)
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return conversation
    
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error fetching conversation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch conversation: {str(e)}"
        )      
        
        
        
# MESSAGE ENDPOINTS

@router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
async def get_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    Get messages in a conversation.
    
    - Returns messages in reverse chronological order (newest first)
    - User must be a participant in the conversation.
    
    """
    try:
        if not verify_user_in_conversation(conversation_id, current_user.id, current_user.role):
            raise HTTPException(
                status_code=403,
                detail="You are not a participant in this conversation"
            )
        
        messages = get_conversation_messages(
            conversation_id=conversation_id,
            limit=limit
        )
        
        log.info(f"User {current_user.id} retrieved {len(messages)} messages from conversation {conversation_id}")
        
        return messages
    
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error fetching messages: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch messages: {str(e)}"
        )      


@router.post("/conversations/{conversation_id}/messages", response_model=dict)
async def send_message_endpoint(
    conversation_id: str,
    request: SendMessageRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Send a message in a conversation
    
    - User must be a participant in the conversation.
    - Message content is limited to 2000 characters
    
    Returns message_id of the created message
    """
    try:
        if not verify_user_in_conversation(conversation_id, current_user.id, current_user.role):
            raise HTTPException(
                status_code=403,
                detail="You are not a participant in this conversation"
            )
        
        message_id = send_message(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            sender_role=current_user.role,
            content=request.content,
            message_type=request.message_type,
            image_url=request.image_url
        )
        
        log.info(f"User {current_user.id} sent message {message_id} in conversation {conversation_id}")
        
        # TODO: Send push notification to recipient
        # - Get recipient_id from conversation
        # - Send Expo push notification
        
        return {"message_id": message_id}
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Error sending message: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send message: {str(e)}"
        ) 