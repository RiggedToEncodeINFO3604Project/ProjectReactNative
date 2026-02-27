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