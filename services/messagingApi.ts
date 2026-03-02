// =======================================================
// = Messaging API Service                               =
// = Handles REST API calls and WebSocket connections    =
// =======================================================

import { Conversation, Message, SendMessageRequest } from "@/types/scheduling";
import api from "./schedulingApi";

// ======================================================================
// = WebSocket Message Type Interfaces                                  =
// ======================================================================

// Base WebSocket message type
export interface WebSocketMessage {
  type: string;
  data?: unknown;
}

// Subscribe to a conversation
export interface SubscribeConversationMessage extends WebSocketMessage {
  type: "subscribe_conversation";
  data: {
    conversation_id: string;
  };
}

// Unsubscribe from a conversation
export interface UnsubscribeConversationMessage extends WebSocketMessage {
  type: "unsubscribe_conversation";
  data: {
    conversation_id: string;
  };
}

// Ping message for keepalive
export interface PingMessage extends WebSocketMessage {
  type: "ping";
}

// Pong response to ping
export interface PongMessage extends WebSocketMessage {
  type: "pong";
}

// New message notification from server
export interface NewMessageNotification extends WebSocketMessage {
  type: "new_message";
  data: Message;
}

// Connection established confirmation
export interface ConnectionEstablished extends WebSocketMessage {
  type: "connection_established";
  data: {
    user_id: string;
    role: string;
  };
}

// Subscribed confirmation
export interface SubscribedMessage extends WebSocketMessage {
  type: "subscribed";
  data: {
    conversation_id: string;
  };
}

// Unsubscribed confirmation
export interface UnsubscribedMessage extends WebSocketMessage {
  type: "unsubscribed";
  data: {
    conversation_id: string;
  };
}

// Error message from server
export interface ErrorMessage extends WebSocketMessage {
  type: "error";
  data: {
    message: string;
  };
}

// Union type for all incoming WebSocket messages
export type IncomingWebSocketMessage =
  | NewMessageNotification
  | ConnectionEstablished
  | SubscribedMessage
  | UnsubscribedMessage
  | PongMessage
  | ErrorMessage;

// ======================================================================
// = REST API Functions                                                 =
// ======================================================================

/**
 * Get all conversations for the current user
 * @returns Array of conversations sorted by most recent activity
 */
export const getConversations = async (): Promise<Conversation[]> => {
  const response = await api.get<Conversation[]>(
    "/api/messaging/conversations",
  );
  return response.data;
};

/**
 * Start a conversation with another user
 * @param recipientId - The ID of the user to start a conversation with
 * @returns Object containing the conversation_id
 */
export const startConversation = async (
  recipientId: string,
): Promise<{ conversation_id: string }> => {
  const response = await api.post<{ conversation_id: string }>(
    "/api/messaging/conversations/start",
    null,
    {
      params: { recipient_id: recipientId },
    },
  );
  return response.data;
};

/**
 * Get details of a specific conversation
 * @param conversationId - The ID of the conversation
 * @returns Conversation details
 */
export const getConversation = async (
  conversationId: string,
): Promise<Conversation> => {
  const response = await api.get<Conversation>(
    `/api/messaging/conversations/${conversationId}`,
  );
  return response.data;
};

/**
 * Get messages in a conversation
 * @param conversationId - The ID of the conversation
 * @param limit - Maximum number of messages to retrieve (1-100, default 50)
 * @returns Array of messages in reverse chronological order (newest first)
 */
export const getMessages = async (
  conversationId: string,
  limit?: number,
): Promise<Message[]> => {
  const response = await api.get<Message[]>(
    `/api/messaging/conversations/${conversationId}/messages`,
    {
      params: limit ? { limit } : undefined,
    },
  );
  return response.data;
};

/**
 * Send a message in a conversation
 * @param conversationId - The ID of the conversation
 * @param data - The message data (content, message_type, optional image_url)
 * @returns Object containing the message_id
 */
export const sendMessage = async (
  conversationId: string,
  data: SendMessageRequest,
): Promise<{ message_id: string }> => {
  const response = await api.post<{ message_id: string }>(
    `/api/messaging/conversations/${conversationId}/messages`,
    data,
  );
  return response.data;
};

// ======================================================================
// = WebSocket Manager Class                                            =
// ======================================================================

// Connection state type
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

// Event callback types
export type MessageReceivedCallback = (message: Message) => void;
export type ConnectionChangeCallback = (state: ConnectionState) => void;
export type ErrorCallback = (error: Error) => void;

// Configuration options for MessagingWebSocket
export interface MessagingWebSocketOptions {
  // Callback when a new message is received
  onMessageReceived?: MessageReceivedCallback;
  // Callback when connection state changes
  onConnectionChange?: ConnectionChangeCallback;
  // Callback when an error occurs
  onError?: ErrorCallback;
  // Auto-reconnect on disconnect (default: true)
  autoReconnect?: boolean;
  // Maximum number of reconnection attempts (default: 5)
  maxReconnectAttempts?: number;
  // Base delay for exponential backoff in ms (default: 1000)
  reconnectBaseDelay?: number;
  // Maximum delay between reconnection attempts in ms (default: 30000)
  maxReconnectDelay?: number;
  // Ping interval in ms (default: 30000)
  pingInterval?: number;
}

// Manages WebSocket connection for real-time messaging
export class MessagingWebSocket {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private connectionState: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private pingIntervalId: NodeJS.Timeout | null = null;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private subscribedConversations: Set<string> = new Set();

  // Configuration
  private readonly options: Required<MessagingWebSocketOptions>;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly pingIntervalMs: number;

  constructor(options: MessagingWebSocketOptions = {}) {
    this.options = {
      onMessageReceived: options.onMessageReceived ?? (() => {}),
      onConnectionChange: options.onConnectionChange ?? (() => {}),
      onError: options.onError ?? (() => {}),
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectBaseDelay: options.reconnectBaseDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      pingInterval: options.pingInterval ?? 30000,
    };

    this.maxReconnectAttempts = this.options.maxReconnectAttempts;
    this.reconnectBaseDelay = this.options.reconnectBaseDelay;
    this.maxReconnectDelay = this.options.maxReconnectDelay;
    this.pingIntervalMs = this.options.pingInterval;
  }

  // Get the current connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Check if the WebSocket is currently connected
  isConnected(): boolean {
    return (
      this.connectionState === "connected" &&
      this.ws?.readyState === WebSocket.OPEN
    );
  }

  // Set the connection state and notify listeners
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.options.onConnectionChange(state);
  }

  /**
   * Get the WebSocket URL from the API URL
   * Converts http:// to ws:// and https:// to wss://
   */
  private getWebSocketUrl(): string {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

    if (apiUrl.startsWith("https://")) {
      return apiUrl.replace("https://", "wss://") + "/ws";
    } else if (apiUrl.startsWith("http://")) {
      return apiUrl.replace("http://", "ws://") + "/ws";
    }

    // Fallback - assume ws for localhost development
    return `ws://${apiUrl}/ws`;
  }

  /**
   * Connect to the WebSocket server
   * @param token - JWT authentication token
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[MessagingWebSocket] Already connected");
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("[MessagingWebSocket] Already connecting");
      return;
    }

    this.token = token;
    this.setConnectionState("connecting");

    try {
      const wsUrl = `${this.getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.setConnectionState("disconnected");
      this.options.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
      this.scheduleReconnect();
    }
  }

  // Handle WebSocket open event
  private handleOpen(): void {
    console.log("[MessagingWebSocket] Connected successfully");
    this.setConnectionState("connected");
    this.reconnectAttempts = 0;

    // Resubscribe to previously subscribed conversations
    this.resubscribeToConversations();

    // Start ping interval
    this.startPingInterval();
  }

  // Handle incoming WebSocket messages
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as IncomingWebSocketMessage;
      console.log("[MessagingWebSocket] Received:", message.type);

      switch (message.type) {
        case "new_message":
          this.options.onMessageReceived(message.data);
          break;

        case "connection_established":
          console.log(
            "[MessagingWebSocket] Connection established for user:",
            message.data.user_id,
          );
          break;

        case "subscribed":
          console.log(
            "[MessagingWebSocket] Subscribed to conversation:",
            message.data.conversation_id,
          );
          break;

        case "unsubscribed":
          console.log(
            "[MessagingWebSocket] Unsubscribed from conversation:",
            message.data.conversation_id,
          );
          break;

        case "pong":
          // Pong received, connection is alive
          break;

        case "error": {
          const errorMsg = message as ErrorMessage;
          console.error(
            "[MessagingWebSocket] Server error:",
            errorMsg.data.message,
          );
          this.options.onError(new Error(errorMsg.data.message));
          break;
        }

        default:
          console.warn(
            "[MessagingWebSocket] Unknown message type:",
            (message as WebSocketMessage).type,
          );
      }
    } catch (error) {
      console.error("[MessagingWebSocket] Error parsing message:", error);
      this.options.onError(
        error instanceof Error ? error : new Error("Failed to parse message"),
      );
    }
  }

  // Handle WebSocket close event
  private handleClose(event: CloseEvent): void {
    console.log(
      `[MessagingWebSocket] Connection closed: ${event.code} - ${event.reason}`,
    );
    this.stopPingInterval();

    if (this.connectionState !== "disconnected") {
      this.setConnectionState("disconnected");

      if (this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  // Handle WebSocket error event
  private handleError(event: Event): void {
    console.error("[MessagingWebSocket] WebSocket error:", event);
    this.options.onError(new Error("WebSocket connection error"));
  }

  // Schedule a reconnection attempt with exponential backoff
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[MessagingWebSocket] Max reconnection attempts reached");
      this.options.onError(new Error("Max reconnection attempts reached"));
      return;
    }

    this.setConnectionState("reconnecting");
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff: baseDelay * 2^attempt
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );

    console.log(
      `[MessagingWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeoutId = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  // Start the ping interval for keepalive
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingIntervalId = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping" });
      }
    }, this.pingIntervalMs);
  }

  // Stop the ping interval
  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  // Send a message to the WebSocket server
  private send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn(
        "[MessagingWebSocket] Cannot send message, WebSocket is not open",
      );
    }
  }

  /**
   * Subscribe to a conversation to receive real-time messages
   * @param conversationId - The ID of the conversation to subscribe to
   */
  subscribeToConversation(conversationId: string): void {
    this.subscribedConversations.add(conversationId);

    if (this.isConnected()) {
      this.send({
        type: "subscribe_conversation",
        data: { conversation_id: conversationId },
      });
    }
  }

  /**
   * Unsubscribe from a conversation
   * @param conversationId - The ID of the conversation to unsubscribe from
   */
  unsubscribeFromConversation(conversationId: string): void {
    this.subscribedConversations.delete(conversationId);

    if (this.isConnected()) {
      this.send({
        type: "unsubscribe_conversation",
        data: { conversation_id: conversationId },
      });
    }
  }

  // Resubscribe to all previously subscribed conversations after reconnection
  private resubscribeToConversations(): void {
    this.subscribedConversations.forEach((conversationId) => {
      this.send({
        type: "subscribe_conversation",
        data: { conversation_id: conversationId },
      });
    });
  }

  // Disconnect from the WebSocket server
  disconnect(): void {
    console.log("[MessagingWebSocket] Disconnecting...");

    // Stop timers
    this.stopPingInterval();
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Clear reconnect attempts to prevent auto-reconnect
    this.reconnectAttempts = this.maxReconnectAttempts;

    // Close connection
    if (this.ws) {
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }

    this.token = null;
    this.subscribedConversations.clear();
    this.setConnectionState("disconnected");
  }

  // Update event callbacks
  setCallbacks(callbacks: Partial<MessagingWebSocketOptions>): void {
    if (callbacks.onMessageReceived) {
      this.options.onMessageReceived = callbacks.onMessageReceived;
    }
    if (callbacks.onConnectionChange) {
      this.options.onConnectionChange = callbacks.onConnectionChange;
    }
    if (callbacks.onError) {
      this.options.onError = callbacks.onError;
    }
  }

  // Get the list of currently subscribed conversations
  getSubscribedConversations(): string[] {
    return Array.from(this.subscribedConversations);
  }
}
export const messagingSocket = new MessagingWebSocket();

// ======================================================================
// = Default Export                                                     =
// ======================================================================

export default {
  // REST API
  getConversations,
  startConversation,
  getConversation,
  getMessages,
  sendMessage,
  // WebSocket singleton
  messagingSocket,
};
