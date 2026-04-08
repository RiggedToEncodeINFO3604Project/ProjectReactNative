// =======================================================
// = Messaging API Service                               =
// = Handles REST API calls and WebSocket connections    =
// =======================================================

import { Conversation, Message, SendMessageRequest } from "@/types/scheduling";
import Constants from "expo-constants";
import api from "./schedulingApi";

const normalizeUrl = (value?: string | null): string =>
  (value || "").trim().replace(/\/+$/, "");

const extractPort = (value: string): string => {
  const match = value.match(/:(\d+)(?:\/|$)/);
  return match?.[1] || "8081";
};

const isPrivateOrLocalHost = (hostname: string): boolean => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
};

const extractExpoHost = (): string | null => {
  const expoConfigHost = (Constants.expoConfig as { hostUri?: string } | null)
    ?.hostUri;
  if (expoConfigHost) {
    return expoConfigHost;
  }

  const manifest2Host = (
    Constants as typeof Constants & {
      manifest2?: {
        extra?: {
          expoGo?: {
            debuggerHost?: string;
          };
        };
      };
    }
  ).manifest2?.extra?.expoGo?.debuggerHost;

  if (manifest2Host) {
    return manifest2Host;
  }

  if (typeof window !== "undefined" && window.location.host) {
    return window.location.host;
  }

  return null;
};

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

// Messages read notification from server
export interface MessagesReadNotification extends WebSocketMessage {
  type: "messages_read";
  data: {
    conversation_id: string;
    reader_role: string;
  };
}

// Union type for all incoming WebSocket messages
export type IncomingWebSocketMessage =
  | NewMessageNotification
  | ConnectionEstablished
  | SubscribedMessage
  | UnsubscribedMessage
  | PongMessage
  | ErrorMessage
  | MessagesReadNotification;

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
    { recipient_id: recipientId },
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
): Promise<{ message_id: string; filtered_content?: string }> => {
  const response = await api.post<{
    message_id: string;
    filtered_content?: string;
  }>(
    `/api/messaging/conversations/${conversationId}/messages`,
    data,
  );
  return response.data;
};

/**
 * Mark a conversation as read
 * @param conversationId - The ID of the conversation to mark as read
 */
export const markConversationAsRead = async (
  conversationId: string,
): Promise<void> => {
  await api.post(`/api/messaging/conversations/${conversationId}/read`);
};

/**
 * Mark a specific message as read
 * @param conversationId - The ID of the conversation
 * @param messageId - The ID of the message to mark as read
 */
export const markMessageAsRead = async (
  conversationId: string,
  messageId: string,
): Promise<void> => {
  await api.post(
    `/api/messaging/conversations/${conversationId}/messages/${messageId}/read`,
  );
};

// ====================================================================== // = WebSocket Manager Class                                            =
// ======================================================================

// Connection state type
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "fallback_polling"; // Fallback when WebSocket is unavailable

// Event callback types
export type MessageReceivedCallback = (message: Message) => void;
export type ConnectionChangeCallback = (state: ConnectionState) => void;
export type ErrorCallback = (error: Error) => void;

// Configuration options for MessagingWebSocket
export interface MessagingWebSocketOptions {
  // Callback when a new message is received
  onMessageReceived?: MessageReceivedCallback;
  // Callback when messages are read by the other user
  onMessagesRead?: (data: {
    conversation_id: string;
    reader_role: string;
  }) => void;
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

  // Polling fallback for Render free tier
  private pollingIntervalId: NodeJS.Timeout | null = null;
  private isPollingEnabled = false;
  private readonly POLLING_INTERVAL = 5000; // 5 seconds

  // Configuration
  private readonly options: Required<MessagingWebSocketOptions>;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly pingIntervalMs: number;

  constructor(options: MessagingWebSocketOptions = {}) {
    this.options = {
      onMessageReceived: options.onMessageReceived ?? (() => {}),
      onMessagesRead: options.onMessagesRead ?? (() => {}),
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
   * Ensures secure WebSocket (wss://) for HTTPS pages
   */
  private getWebSocketUrl(): string {
    const apiUrl = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
    console.log("[MessagingWebSocket] EXPO_PUBLIC_API_URL:", apiUrl);

    // Remove trailing slash if present to avoid double slashes
    let normalizedUrl = apiUrl;
    const isLocalhostConfig =
      !normalizedUrl ||
      normalizedUrl.includes("localhost") ||
      normalizedUrl.includes("127.0.0.1");

    if (typeof window !== "undefined") {
      if (isLocalhostConfig) {
        if (normalizedUrl) {
          const configuredPort = extractPort(normalizedUrl);
          const currentHostname = window.location.hostname;
          if (isPrivateOrLocalHost(currentHostname)) {
            normalizedUrl = `${window.location.protocol}//${currentHostname}:${configuredPort}`;
          } else {
            normalizedUrl = window.location.origin;
          }
        } else {
          normalizedUrl = window.location.origin;
        }
      }
    } else if (isLocalhostConfig) {
      const expoHost = extractExpoHost();
      if (expoHost) {
        normalizedUrl = normalizedUrl.replace(
          /(localhost|127\.0\.0\.1)(:\d+)?/,
          expoHost,
        );
      }
    }

    if (normalizedUrl.startsWith("https://")) {
      const wsUrl = normalizedUrl.replace("https://", "wss://") + "/ws";
      console.log("[MessagingWebSocket] Using WSS (HTTPS detected):", wsUrl);
      return wsUrl;
    } else if (normalizedUrl.startsWith("http://")) {
      const wsUrl = normalizedUrl.replace("http://", "ws://") + "/ws";
      console.log("[MessagingWebSocket] Using WS (HTTP detected):", wsUrl);
      return wsUrl;
    }

    // Improved fallback - detect current protocol in browser
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = normalizedUrl || window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      console.log("[MessagingWebSocket] Using fallback (browser):", wsUrl);
      return wsUrl;
    }

    // Default to secure WebSocket for production safety
    const defaultUrl = `wss://${normalizedUrl || "localhost"}/ws`;
    console.log("[MessagingWebSocket] Using default WSS:", defaultUrl);
    return defaultUrl;
  }

  /**
   * Connect to the WebSocket server
   * @param token - Firebase ID token
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
      const baseWsUrl = this.getWebSocketUrl();
      const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(token)}`;
      console.log(`[MessagingWebSocket] Connecting to: ${baseWsUrl}?token=***`);

      // Log connection diagnostics for debugging Render issues
      console.log("[MessagingWebSocket] Connection diagnostics:", {
        url: wsUrl.replace(token, "***"),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
        protocol:
          typeof window !== "undefined" ? window.location.protocol : "N/A",
        host: typeof window !== "undefined" ? window.location.host : "N/A",
      });

      this.ws = new WebSocket(wsUrl);

      // Set connection timeout for Render (15s)
      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          console.error(
            "[MessagingWebSocket] Connection timeout - forcing close",
          );
          this.ws.close();
          this.options.onError(
            new Error("Connection timeout - server may be unavailable"),
          );
        }
      }, 15000);

      // Clear timeout on successful connection
      const clearConnectionTimeout = () => clearTimeout(connectionTimeout);
      this.ws.addEventListener("open", clearConnectionTimeout, { once: true });
      this.ws.addEventListener("close", clearConnectionTimeout, { once: true });
      this.ws.addEventListener("error", clearConnectionTimeout, { once: true });

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = (event) => {
        clearConnectionTimeout();
        this.handleError(event);
      };
    } catch (error) {
      console.error("[MessagingWebSocket] Connection error:", error);
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

        case "messages_read": {
          const readNotification = message as MessagesReadNotification;
          console.log(
            "[MessagingWebSocket] Messages read in conversation:",
            readNotification.data.conversation_id,
            "by role:",
            readNotification.data.reader_role,
          );
          // Call the callback if provided
          if (this.options.onMessagesRead) {
            this.options.onMessagesRead(readNotification.data);
          }
          break;
        }

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

    // Provide more specific error messages for common issues
    let errorMessage = "WebSocket connection error";

    // Check for specific browser error types
    if (typeof event !== "undefined" && event.target) {
      const target = event.target as WebSocket;
      if (target.readyState === WebSocket.CLOSED) {
        // Connection was refused or failed
        errorMessage =
          "WebSocket connection refused - server may be unavailable or WebSocket proxy not configured correctly";
        console.error("[MessagingWebSocket] Connection refused. Check:");
        console.error("  1. Server is running and accessible");
        console.error("  2. WebSocket endpoint /ws is properly configured");
        console.error("  3. Firewall/reverse proxy allows WebSocket upgrade");
        console.error("  4. Render health check is passing");
      }
    }

    this.options.onError(new Error(errorMessage));
  }

  // Schedule a reconnection attempt with exponential backoff
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[MessagingWebSocket] Max reconnection attempts reached");
      console.log("[MessagingWebSocket] Switching to polling fallback mode");
      this.options.onError(
        new Error(
          "Max reconnection attempts reached - switching to polling fallback",
        ),
      );
      // Start polling as fallback for Render free tier limitations
      this.startPolling();
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

  // Start polling fallback when WebSocket is unavailable
  private startPolling(): void {
    if (this.isPollingEnabled) return;

    console.log("[MessagingWebSocket] Starting polling fallback");
    this.isPollingEnabled = true;
    this.setConnectionState("fallback_polling");

    // Poll for new messages every 5 seconds
    this.pollingIntervalId = setInterval(async () => {
      if (!this.token || this.subscribedConversations.size === 0) return;

      try {
        // Fetch latest messages for subscribed conversations
        for (const conversationId of this.subscribedConversations) {
          const messages = await getMessages(conversationId, 1);
          if (messages.length > 0) {
            // Check if this is a new message (would need timestamp comparison in real implementation)
            // For now, just notify that polling is working
            console.log(
              `[MessagingWebSocket] Polled messages for ${conversationId}`,
            );
          }
        }
      } catch (error) {
        console.error("[MessagingWebSocket] Polling error:", error);
      }
    }, this.POLLING_INTERVAL);
  }

  // Stop polling fallback
  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    this.isPollingEnabled = false;
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
    this.stopPolling();
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
    if (callbacks.onMessagesRead) {
      this.options.onMessagesRead = callbacks.onMessagesRead;
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

  // Check if using polling fallback (Render free tier)
  isUsingPollingFallback(): boolean {
    return this.isPollingEnabled;
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
