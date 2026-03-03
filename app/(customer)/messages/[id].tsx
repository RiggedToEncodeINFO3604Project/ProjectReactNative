// =====================================================
// = Chat Screen - Customer                            =
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
  getConversation,
  getMessages,
  markConversationAsRead,
  messagingSocket,
  sendMessage,
} from "@/services/messagingApi";
import { Conversation, Message } from "@/types/scheduling";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

  // Message search state
  const [isMessageSearching, setIsMessageSearching] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  const messagesScrollViewRef = useRef<ScrollView>(null);
  const messageRefs = useRef<Map<string, View>>(new Map());

  // Get other user details
  const otherUserName = useMemo(() => {
    if (!conversation) return "";
    return conversation.provider_name || "Provider";
  }, [conversation]);

  const otherUserAvatar = useMemo(() => {
    if (!conversation) return undefined;
    return conversation.provider_avatar;
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
      setMessages(data.reverse());
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [conversationId]);

  // Handle new message from WebSocket
  const handleNewMessage = useCallback(
    (message: Message) => {
      if (message.conversation_id === conversationId) {
        setMessages((prev) => {
          // Check if message already exists
          if (prev.find((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
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

    return () => {
      // Cleanup WebSocket on unmount
      messagingSocket.disconnect();
    };
  }, [
    token,
    fetchConversation,
    fetchMessages,
    handleNewMessage,
    handleConnectionChange,
  ]);

  // Subscribe to conversation
  useEffect(() => {
    if (conversationId && messagingSocket.isConnected()) {
      messagingSocket.subscribeToConversation(conversationId);

      return () => {
        messagingSocket.unsubscribeFromConversation(conversationId);
      };
    }
  }, [conversationId]);

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

      // Optimistic update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: currentUserId,
        sender_role: user?.role || "Customer",
        content: trimmedContent,
        message_type: "text",
        created_at: new Date().toISOString(),
        read: false,
        status: "sent",
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        await sendMessage(conversationId, {
          content: trimmedContent,
          message_type: "text",
        });
      } catch (error) {
        console.error("Error sending message:", error);
        // Remove optimistic message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMessage.id),
        );
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId, user?.role],
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
