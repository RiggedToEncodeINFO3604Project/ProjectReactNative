import json
import logging
from typing import Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect, Query, status

from auth import resolve_user_from_token

log = logging.getLogger("skedulelt.websocket")


# Represents a single WebSocket connection
class Connection:
    
    def __init__(self, websocket: WebSocket, user_id: str, role: str):
        self.websocket = websocket
        self.user_id = user_id
        self.role = role
        self.subscribed_conversations: Set[str] = set()
    
    # Send JSON data to the connected client
    async def send_json(self, data: dict):
        await self.websocket.send_json(data)
    
    # Subscribe to a specific conversation
    def subscribe_conversation(self, conversation_id: str):
        self.subscribed_conversations.add(conversation_id)
    
    # Unsubscribe from a specific conversation
    def unsubscribe_conversation(self, conversation_id: str):
        self.subscribed_conversations.discard(conversation_id)
    
    # Check if connection is subscribed to a conversation
    def is_subscribed_to(self, conversation_id: str) -> bool:
        return conversation_id in self.subscribed_conversations


# Manages WebSocket connections for real-time messaging
class WebSocketManager:
    
    def __init__(self):
        # user_id -> list of connections (a user can have multiple connections from different devices)
        self.active_connections: Dict[str, List[Connection]] = {}
        # conversation_id -> set of user_ids subscribed
        self.conversation_subscribers: Dict[str, Set[str]] = {}
    
    # Authenticate a WebSocket connection using a Firebase ID token
    async def authenticate(self, token: str) -> Optional[dict]:
        try:
            current_user = resolve_user_from_token(token)
            return {
                "user_id": current_user.id,
                "role": str(current_user.role),
            }
        except Exception:
            return None
    
    # Accept a WebSocket connection after authentication
    async def connect(self, websocket: WebSocket, token: str) -> Optional[Connection]:
        log.info(f"WebSocket connection attempt - Client: {websocket.client}")
        
        # Authenticate first
        auth_data = await self.authenticate(token)
        if not auth_data:
            log.warning(f"WebSocket authentication failed - Client: {websocket.client}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None
        
        log.info(f"WebSocket authentication successful for user: {auth_data['user_id']}")
        await websocket.accept()
        log.info(f"WebSocket accepted for user: {auth_data['user_id']}")
        
        user_id = auth_data["user_id"]
        role = auth_data["role"]
        
        connection = Connection(websocket, user_id, role)
        
        # Add to active connections
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(connection)
        
        log.info(f"WebSocket connected: User {user_id} ({role}). Total connections for user: {len(self.active_connections[user_id])}")
        
        # Send confirmation to client
        await connection.send_json({
            "type": "connection_established",
            "data": {
                "user_id": user_id,
                "role": role
            }
        })
        
        return connection
    
    # Remove a WebSocket connection
    def disconnect(self, connection: Connection):
        user_id = connection.user_id
        
        # Remove from conversation subscribers
        for conversation_id in list(connection.subscribed_conversations):
            self._remove_conversation_subscriber(conversation_id, user_id)
        
        # Remove from active connections
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(connection)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        log.info(f"WebSocket disconnected: User {user_id}. Remaining connections: {len(self.active_connections.get(user_id, []))}")

    def is_user_online(self, user_id: str) -> bool:
        return bool(self.active_connections.get(user_id))
    
    # Add a user as a subscriber to a conversation
    def _add_conversation_subscriber(self, conversation_id: str, user_id: str):
        if conversation_id not in self.conversation_subscribers:
            self.conversation_subscribers[conversation_id] = set()
        self.conversation_subscribers[conversation_id].add(user_id)
    
    # Remove a user from conversation subscribers
    def _remove_conversation_subscriber(self, conversation_id: str, user_id: str):
        if conversation_id in self.conversation_subscribers:
            self.conversation_subscribers[conversation_id].discard(user_id)
            if not self.conversation_subscribers[conversation_id]:
                del self.conversation_subscribers[conversation_id]
    
    # Subscribe a connection to receive messages from a specific conversation
    async def subscribe_to_conversation(self, connection: Connection, conversation_id: str):
        # Verify user is a participant in this conversation
        from services.messaging_service import verify_user_in_conversation
        
        if not verify_user_in_conversation(conversation_id, connection.user_id, connection.role):
            await connection.send_json({
                "type": "error",
                "data": {"message": "Not authorized to subscribe to this conversation"}
            })
            return
        
        connection.subscribe_conversation(conversation_id)
        self._add_conversation_subscriber(conversation_id, connection.user_id)
        
        log.info(f"User {connection.user_id} subscribed to conversation {conversation_id}")
        
        await connection.send_json({
            "type": "subscribed",
            "data": {"conversation_id": conversation_id}
        })
    
    # Unsubscribe a connection from a conversation
    async def unsubscribe_from_conversation(self, connection: Connection, conversation_id: str):
        connection.unsubscribe_conversation(conversation_id)
        self._remove_conversation_subscriber(conversation_id, connection.user_id)
        
        log.info(f"User {connection.user_id} unsubscribed from conversation {conversation_id}")
        
        await connection.send_json({
            "type": "unsubscribed",
            "data": {"conversation_id": conversation_id}
        })
    
    # Broadcast a message to all subscribers of a conversation
    async def broadcast_to_conversation(self, conversation_id: str, message: dict, exclude_user_id: Optional[str] = None):
        if conversation_id not in self.conversation_subscribers:
            return
        
        broadcast_data = {
            "type": "new_message",
            "data": message
        }
        
        # Get all user IDs subscribed to this conversation
        user_ids = self.conversation_subscribers[conversation_id]
        
        sent_count = 0
        for user_id in user_ids:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            
            # Send to all active connections for this user
            connections = self.active_connections.get(user_id, [])
            for connection in connections:
                # Only send if the connection is subscribed to this conversation
                if connection.is_subscribed_to(conversation_id):
                    try:
                        await connection.send_json(broadcast_data)
                        sent_count += 1
                    except Exception as e:
                        log.error(f"Error sending message to user {user_id}: {e}")
        
        log.debug(f"Broadcasted message to {sent_count} connections in conversation {conversation_id}")
    
    # Broadcast message read status to all subscribers of a conversation
    async def broadcast_message_read(self, conversation_id: str, user_role: str):
        log.info(f"[DEBUG] broadcast_message_read called for conversation {conversation_id} by role {user_role}")
        if conversation_id not in self.conversation_subscribers:
            log.warning(f"[DEBUG] No subscribers found for conversation {conversation_id}")
            return
        
        broadcast_data = {
            "type": "messages_read",
            "data": {
                "conversation_id": conversation_id,
                "reader_role": user_role
            }
        }
        
        # Get all user IDs subscribed to this conversation
        user_ids = self.conversation_subscribers[conversation_id]
        log.info(f"[DEBUG] Found {len(user_ids)} subscribers for conversation {conversation_id}: {user_ids}")
        
        sent_count = 0
        for user_id in user_ids:
            # Send to all active connections for this user
            connections = self.active_connections.get(user_id, [])
            log.info(f"[DEBUG] User {user_id} has {len(connections)} active connections")
            for connection in connections:
                # Only send if the connection is subscribed to this conversation
                if connection.is_subscribed_to(conversation_id):
                    try:
                        await connection.send_json(broadcast_data)
                        sent_count += 1
                        log.info(f"[DEBUG] Sent messages_read to user {user_id}")
                    except Exception as e:
                        log.error(f"Error sending read status to user {user_id}: {e}")
        
        log.info(f"[DEBUG] Broadcasted read status to {sent_count} connections in conversation {conversation_id}")
    
    # Send a message directly to all connections of a specific user
    async def send_to_user(self, user_id: str, message: dict):
        connections = self.active_connections.get(user_id, [])
        
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                log.error(f"Error sending direct message to user {user_id}: {e}")
    
    # Handle incoming WebSocket messages from clients
    async def handle_message(self, connection: Connection, data: dict):
        msg_type = data.get("type")
        msg_data = data.get("data", {})
        
        if msg_type == "subscribe_conversation":
            conversation_id = msg_data.get("conversation_id")
            if conversation_id:
                await self.subscribe_to_conversation(connection, conversation_id)
        
        elif msg_type == "unsubscribe_conversation":
            conversation_id = msg_data.get("conversation_id")
            if conversation_id:
                await self.unsubscribe_from_conversation(connection, conversation_id)
        
        elif msg_type == "ping":
            await connection.send_json({"type": "pong"})
        
        else:
            await connection.send_json({
                "type": "error",
                "data": {"message": f"Unknown message type: {msg_type}"}
            })
    
    # Get statistics about active connections
    def get_connection_stats(self) -> dict:
        total_connections = sum(len(conns) for conns in self.active_connections.values())
        return {
            "total_users": len(self.active_connections),
            "total_connections": total_connections,
            "subscribed_conversations": len(self.conversation_subscribers)
        }


# Global WebSocket manager instance
websocket_manager = WebSocketManager()
