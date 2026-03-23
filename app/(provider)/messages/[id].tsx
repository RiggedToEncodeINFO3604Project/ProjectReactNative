// =====================================================
// = Chat Screen - Provider                            =
// = Full-screen chat for a specific conversation      =
// =====================================================

import { ChatHeader } from "@/components/messaging/ChatHeader";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { MessageInput } from "@/components/messaging/MessageInput";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  isFirebaseConfigured,
  subscribeToConversationMessages,
  unsubscribeFromConversation,
} from "@/services/firebaseMessaging";
import {
  getConversation,
  getMessages,
  markConversationAsRead,
  markMessageAsRead,
  messagingSocket,
  sendMessage,
} from "@/services/messagingApi";
import { Conversation, Message, MessageStatus } from "@/types/scheduling";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ChatScreen() {
  const { token, user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const currentUserId = user?.id || "";
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // State
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [firebaseConnected, setFirebaseConnected] = useState(false);

  // Message search state
  const [isMessageSearching, setIsMessageSearching] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  const messagesScrollViewRef = useRef<ScrollView>(null);
  const messageRefs = useRef<Map<string, View>>(new Map());

  // Get other user details (for provider, the other user is the customer)
  const otherUserName = useMemo(() => {
    if (!conversation) return "";
    return conversation.customer_name || "Customer";
  }, [conversation]);

  const otherUserAvatar = useMemo(() => {
    if (!conversation) return undefined;
    return conversation.customer_avatar;
  }, [conversation]);

  // Search results - filter messages based on search query
  const searchResults = useMemo(() => {
    if (!messageSearchQuery.trim()) return [];
    const query = messageSearchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.message_type === "text" && m.content.toLowerCase().includes(query),
    );
  }, [messages, messageSearchQuery]);

  // Fetch conversation details
  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    try {
      const data = await getConversation(conversationId);
      setConversation(data);
    } catch (error) {
      console.error("Error fetching conversation:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  // Fetch messages for conversation
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    try {
      const data = await getMessages(conversationId, 50);
      // Reverse to show oldest first
      setMessages(Array.isArray(data) ? data.reverse() : []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [conversationId]);

  // Handle new message from WebSocket
  const handleNewMessage = useCallback(
    (message: Message) => {
      if (message.conversation_id === conversationId) {
        setMessages((prev) => {
          // Check if message already exists by ID
          const existingById = prev.find((m) => m.id === message.id);
          if (existingById) {
            return prev; // Already have this message
          }

          // Check if a temp message that matches (same sender, similar time)
          const tempMessage = prev.find(
            (m) =>
              m.id.startsWith("temp-") &&
              m.sender_id === message.sender_id &&
              m.content === message.content &&
              Math.abs(
                new Date(m.created_at).getTime() -
                  new Date(message.created_at).getTime(),
              ) < 5000,
          );

          if (tempMessage) {
            // Replace temp message with real one
            return prev.map((m) => (m.id === tempMessage.id ? message : m));
          }
          return [...prev, message];
        });
      }
    },
    [conversationId],
  );

  // Handle messages read notification from WebSocket (backup - Firebase handles primary updates)
  const handleMessagesRead = useCallback(
    (data: { conversation_id: string; reader_role: string }) => {
      console.log("[Chat] WebSocket messages_read received:", data);
      // Trigger a refresh of messages from API to ensure we have latest read status
      fetchMessages();
    },
    [fetchMessages],
  );

  // Handle new message from Firebase
  const handleFirebaseMessages = useCallback(
    (firebaseMessages: Message[]) => {
      if (!conversationId || !firebaseMessages.length) return;

      setMessages((prev) => {
        if (!prev || !Array.isArray(prev)) {
          return firebaseMessages;
        }

        // Create a map of existing messages by ID
        const existingMap = new Map(prev.map((m) => [m.id, m]));
        let hasChanges = false;

        // Process all Firebase messages
        firebaseMessages.forEach((fm) => {
          const existing = existingMap.get(fm.id);

          if (!existing) {
            // Check if we have a temp message that matches this real message
            const tempMatch = prev.find(
              (m) =>
                m &&
                m.id &&
                m.id.startsWith("temp-") &&
                m.sender_id === fm.sender_id &&
                m.content === fm.content &&
                Math.abs(
                  new Date(m.created_at).getTime() -
                    new Date(fm.created_at).getTime(),
                ) < 5000,
            );

            if (tempMatch) {
              // Replace temp with real message from Firebase
              console.log(
                "[Firebase] Replacing temp message:",
                tempMatch.id,
                "->",
                fm.id,
              );
              // Remove the temp message and add the real message
              existingMap.delete(tempMatch.id);
              existingMap.set(fm.id, fm);
              hasChanges = true;
            } else {
              // Completely new message
              console.log(
                "[Firebase] Adding new message:",
                fm.id,
                "status:",
                fm.status,
              );
              existingMap.set(fm.id, fm);
              hasChanges = true;
            }
          } else {
            // Existing message - check if status or read changed
            const statusChanged = existing.status !== fm.status;
            const readChanged = existing.read !== fm.read;

            if (statusChanged || readChanged) {
              console.log(
                `[Firebase] Message ${fm.id} changed: status ${existing.status}->${fm.status}, read ${existing.read}->${fm.read}`,
              );
              existingMap.set(fm.id, fm);
              hasChanges = true;
            } else if (
              existing.id.startsWith("temp-") &&
              !fm.id.startsWith("temp-")
            ) {
              // Replace temp message with real one from Firebase
              existingMap.set(fm.id, fm);
              hasChanges = true;
            }
          }
        });

        if (!hasChanges && prev.length > 0) {
          return prev;
        }

        // Convert back to array and sort by time
        const allMessages = Array.from(existingMap.values()).sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        return allMessages;
      });
      setFirebaseConnected(true);
    },
    [conversationId],
  );

  // Handle connection state change
  const handleConnectionChange = useCallback(
    (state: "connected" | "disconnected" | "connecting" | "reconnecting") => {
      if (state === "reconnecting") {
        setConnectionState("connecting");
      } else {
        setConnectionState(
          state as "connected" | "disconnected" | "connecting",
        );
      }
    },
    [],
  );

  // Initialize WebSocket and fetch data on mount
  useEffect(() => {
    fetchConversation();
    fetchMessages();

    /*
    // WebSocket is disabled, Firebase now handles all real-time messaging
    // Keeping this code as reference for future use
    if (token) {
      // Set up WebSocket callbacks
      messagingSocket.setCallbacks({
        onMessageReceived: handleNewMessage,
        onConnectionChange: handleConnectionChange,
        onError: (error) => console.error("WebSocket error:", error),
      });

      // Connect WebSocket
      messagingSocket.connect(token);
    }
    */

    return () => {
      // Cleanup WebSocket on unmount
      messagingSocket.disconnect();
      // Cleanup Firebase subscription
      if (conversationId) {
        unsubscribeFromConversation(conversationId);
      }
    };
  }, [
    token,
    fetchConversation,
    fetchMessages,
    handleNewMessage,
    handleConnectionChange,
  ]);

  // Subscribe to conversation (WebSocket)
  useEffect(() => {
    if (conversationId && messagingSocket.isConnected()) {
      messagingSocket.subscribeToConversation(conversationId);

      return () => {
        messagingSocket.unsubscribeFromConversation(conversationId);
      };
    }
  }, [conversationId]);

  // Subscribe to Firebase Firestore real-time updates
  useEffect(() => {
    if (!conversationId || !isFirebaseConfigured()) return;

    const unsubscribe = subscribeToConversationMessages(
      conversationId,
      handleFirebaseMessages,
    );

    return () => {
      unsubscribe();
    };
  }, [conversationId, handleFirebaseMessages]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (conversationId) {
      markConversationAsRead(conversationId).catch(console.error);
    }
  }, [conversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (
      messages.length > 0 &&
      messagesScrollViewRef.current &&
      !isMessageSearching
    ) {
      setTimeout(() => {
        messagesScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isMessageSearching]);

  // Mark individual messages as read when they become visible in the viewport
  const markVisibleMessagesAsRead = useCallback(() => {
    if (!conversationId) return;

    // Get visible messages - check for any unread messages from the other user
    messages.forEach((message) => {
      // Only mark messages from the other party that have a valid (non-temp) ID
      const isFromOther = message.sender_role !== user?.role;
      const isUnread = !message.read;
      const hasValidId = message.id && !message.id.startsWith("temp-");

      if (isFromOther && isUnread && hasValidId) {
        markMessageAsRead(conversationId, message.id).catch(console.error);
      }
    });
  }, [conversationId, messages, user?.role]);

  // Track visibility and mark messages as read when user is viewing
  useEffect(() => {
    // Mark all visible messages as read when the chat becomes visible
    markVisibleMessagesAsRead();

    // Also mark on mount in case the chat was already open
    if (conversationId) {
      markConversationAsRead(conversationId).catch(console.error);
    }
  }, [conversationId, markVisibleMessagesAsRead]);

  // Scroll to current search result
  useEffect(() => {
    if (searchResults.length > 0 && currentResultIndex < searchResults.length) {
      const currentMessage = searchResults[currentResultIndex];
      const messageRef = messageRefs.current.get(currentMessage.id);
      if (messageRef) {
        messageRef.measureLayout(
          messagesScrollViewRef.current?.getInnerViewNode(),
          (x, y) => {
            messagesScrollViewRef.current?.scrollTo({
              y: y - 100,
              animated: true,
            });
          },
          () => {},
        );
      }
    }
  }, [currentResultIndex, searchResults]);

  // Handle back button
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Handle message search
  const handleMessageSearch = useCallback((query: string) => {
    setMessageSearchQuery(query);
    setCurrentResultIndex(0);
    if (query.trim()) {
      setIsMessageSearching(true);
    } else {
      setIsMessageSearching(false);
    }
  }, []);

  // Handle search close
  const handleSearchClose = useCallback(() => {
    setIsMessageSearching(false);
    setMessageSearchQuery("");
    setCurrentResultIndex(0);
  }, []);

  // Navigate to previous search result
  const handleNavigatePrevious = useCallback(() => {
    if (searchResults.length === 0) return;
    setCurrentResultIndex((prev) =>
      prev > 0 ? prev - 1 : searchResults.length - 1,
    );
  }, [searchResults.length]);

  // Navigate to next search result
  const handleNavigateNext = useCallback(() => {
    if (searchResults.length === 0) return;
    setCurrentResultIndex((prev) =>
      prev < searchResults.length - 1 ? prev + 1 : 0,
    );
  }, [searchResults.length]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !content.trim()) return;

      const trimmedContent = content.trim();
      const tempId = `temp-${Date.now()}`;

      // Optimistic update - start with "sending" status
      const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        sender_role: user?.role || "Provider",
        content: trimmedContent,
        message_type: "text",
        created_at: new Date().toISOString(),
        read: false,
        status: "sending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        // Send the message to the server
        const response = await sendMessage(conversationId, {
          content: trimmedContent,
          message_type: "text",
        });

        // Update message status to "sent" on success
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: "sent" as MessageStatus,
                  id: response.message_id || tempId,
                }
              : m,
          ),
        );
      } catch (error) {
        console.error("Error sending message:", error);
        // Update message status to "failed" on error (instead of removing it)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed" as MessageStatus } : m,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId, user?.role],
  );

  // Handle retry for failed messages
  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      // Find the failed message
      const failedMessage = messages.find(
        (m) => m.id === messageId && m.status === "failed",
      );
      if (!failedMessage || !conversationId) return;

      // Update status to "sending"
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "sending" as MessageStatus } : m,
        ),
      );

      try {
        // Retry sending the message
        await sendMessage(conversationId, {
          content: failedMessage.content,
          message_type: failedMessage.message_type,
        });

        // Update status to "sent" on success
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, status: "sent" as MessageStatus } : m,
          ),
        );
      } catch (error) {
        console.error("Error retrying message:", error);
        // Keep status as "failed"
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, status: "failed" as MessageStatus }
              : m,
          ),
        );
      }
    },
    [conversationId, messages],
  );

  // Render loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </View>
    );
  }

  // Render error state if conversation not found
  if (!conversation) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <IconSymbol
            name="exclamationmark.triangle"
            size={48}
            color={theme.icon}
            style={{ opacity: 0.5 }}
          />
          <Text style={[styles.errorText, { color: theme.text }]}>
            Conversation not found
          </Text>
          <Text style={[styles.errorSubtext, { color: theme.icon }]}>
            The conversation may have been deleted or you don't have access
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Chat Header */}
      <ChatHeader
        name={otherUserName}
        avatar={otherUserAvatar}
        status={connectionState === "connected" ? "Online" : undefined}
        onBack={handleBack}
        onSearch={handleMessageSearch}
        isSearching={isMessageSearching}
        searchQuery={messageSearchQuery}
        onSearchClose={handleSearchClose}
        searchResultCount={searchResults.length}
        currentResultIndex={currentResultIndex}
        onNavigatePrevious={handleNavigatePrevious}
        onNavigateNext={handleNavigateNext}
      />

      {/* Messages */}
      {isLoadingMessages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <ScrollView
          ref={messagesScrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 ? (
            <View style={styles.noMessagesState}>
              <IconSymbol
                name="paperplane.fill"
                size={48}
                color={theme.icon}
                style={{ opacity: 0.3 }}
              />
              <Text style={[styles.noMessagesText, { color: theme.icon }]}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          ) : (
            Array.isArray(messages) &&
            messages.map((message, index) => (
              <View
                key={message.id}
                ref={(ref) => {
                  if (ref) {
                    messageRefs.current.set(message.id, ref);
                  }
                }}
              >
                <MessageBubble
                  message={message}
                  isCurrentUser={message.sender_id === currentUserId}
                  showStatus={index === messages.length - 1}
                  highlightQuery={isMessageSearching ? messageSearchQuery : ""}
                  isHighlighted={
                    isMessageSearching &&
                    searchResults.length > 0 &&
                    searchResults[currentResultIndex]?.id === message.id
                  }
                  onRetry={handleRetryMessage}
                />
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Message Input */}
      <MessageInput onSend={handleSendMessage} disabled={isSending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  noMessagesState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  noMessagesText: {
    fontSize: 14,
    marginTop: 16,
  },
});
