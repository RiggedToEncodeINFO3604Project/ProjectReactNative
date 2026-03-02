// =====================================================
// = Messages Screen                                   =
// = Two-pane layout: conversation list + chat         =
// =====================================================

import { ChatHeader } from "@/components/messaging/ChatHeader";
import { ConversationListItem } from "@/components/messaging/ConversationListItem";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { MessageInput } from "@/components/messaging/MessageInput";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import {
  getConversations,
  getMessages,
  messagingSocket,
  sendMessage,
} from "@/services/messagingApi";
import { Conversation, ConversationPreview, Message } from "@/types/scheduling";
import { useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PRIMARY_COLOR = "#0a7ea4";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MOBILE_BREAKPOINT = 768;

// Convert Conversation to ConversationPreview format
function toConversationPreview(
  conversation: Conversation,
  currentUserId: string,
): ConversationPreview {
  const isCustomer = conversation.customer_id === currentUserId;
  const otherUserName = isCustomer
    ? conversation.provider_name || "Provider"
    : conversation.customer_name || "Customer";
  const otherUserAvatar = isCustomer
    ? conversation.provider_avatar
    : conversation.customer_avatar;
  const otherUserId = isCustomer
    ? conversation.provider_id
    : conversation.customer_id;
  const unreadCount = isCustomer
    ? conversation.unread_count_customer
    : conversation.unread_count_provider;

  return {
    id: conversation.id,
    other_user_name: otherUserName,
    other_user_avatar: otherUserAvatar,
    other_user_id: otherUserId,
    other_user_role: isCustomer ? "Provider" : "Customer",
    last_message_content: conversation.last_message?.content,
    last_message_time: conversation.last_message?.created_at,
    unread_count: unreadCount,
    is_last_message_from_me:
      conversation.last_message?.sender_id === currentUserId,
  };
}

export default function MessagesScreen() {
  const { token, user } = useAuth();
  const currentUserId = user?.id || "";

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<
    ConversationPreview[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [isMobile, setIsMobile] = useState(SCREEN_WIDTH < MOBILE_BREAKPOINT);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  // Message search state
  const [isMessageSearching, setIsMessageSearching] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  const messagesScrollViewRef = useRef<ScrollView>(null);
  const messageRefs = useRef<Map<string, View>>(new Map());

  // Get selected conversation details
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId,
  );
  const selectedPreview = selectedConversation
    ? toConversationPreview(selectedConversation, currentUserId)
    : null;

  // Search results - filter messages based on search query
  const searchResults = useMemo(() => {
    if (!messageSearchQuery.trim()) return [];
    const query = messageSearchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.message_type === "text" && m.content.toLowerCase().includes(query),
    );
  }, [messages, messageSearchQuery]);

  // Handle screen resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      const newWidth = Dimensions.get("window").width;
      setIsMobile(newWidth < MOBILE_BREAKPOINT);
    };

    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
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
  }, []);

  // Handle new message from WebSocket
  const handleNewMessage = useCallback(
    (message: Message) => {
      // Update messages if this conversation is open
      if (message.conversation_id === selectedConversationId) {
        setMessages((prev) => {
          // Check if message already exists
          if (prev.find((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }

      // Update conversation list with new last message
      setConversations((prev) => {
        return prev.map((conv) => {
          if (conv.id === message.conversation_id) {
            return {
              ...conv,
              last_message: message,
              updated_at: message.created_at,
              // Increment unread count if not current user
              ...(message.sender_id !== currentUserId && {
                unread_count_customer:
                  message.sender_role === "Provider"
                    ? (conv.unread_count_customer || 0) + 1
                    : conv.unread_count_customer,
                unread_count_provider:
                  message.sender_role === "Customer"
                    ? (conv.unread_count_provider || 0) + 1
                    : conv.unread_count_provider,
              }),
            };
          }
          return conv;
        });
      });
    },
    [selectedConversationId, currentUserId],
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
    fetchConversations();

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
  }, [token, fetchConversations, handleNewMessage, handleConnectionChange]);

  // Subscribe to selected conversation
  useEffect(() => {
    if (selectedConversationId && messagingSocket.isConnected()) {
      messagingSocket.subscribeToConversation(selectedConversationId);

      return () => {
        messagingSocket.unsubscribeFromConversation(selectedConversationId);
      };
    }
  }, [selectedConversationId]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId, fetchMessages]);

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

  // Filter conversations based on search query
  useEffect(() => {
    const previews = conversations.map((conv) =>
      toConversationPreview(conv, currentUserId),
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = previews.filter((preview) =>
        preview.other_user_name.toLowerCase().includes(query),
      );
      setFilteredConversations(filtered);
    } else {
      // Sort by last message time, most recent first
      const sorted = previews.sort((a, b) => {
        const timeA = a.last_message_time
          ? new Date(a.last_message_time).getTime()
          : 0;
        const timeB = b.last_message_time
          ? new Date(b.last_message_time).getTime()
          : 0;
        return timeB - timeA;
      });
      setFilteredConversations(sorted);
    }
  }, [conversations, searchQuery, currentUserId]);

  // Handle conversation selection
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      // Clear message search when changing conversations
      setIsMessageSearching(false);
      setMessageSearchQuery("");
      setCurrentResultIndex(0);
      if (isMobile) {
        setShowChatOnMobile(true);
      }
    },
    [isMobile],
  );

  // Handle back button (mobile)
  const handleBackToList = useCallback(() => {
    setShowChatOnMobile(false);
    setSelectedConversationId(null);
    setIsMessageSearching(false);
    setMessageSearchQuery("");
    setCurrentResultIndex(0);
  }, []);

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
      if (!selectedConversationId || !content.trim()) return;

      const trimmedContent = content.trim();

      // Optimistic update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedConversationId,
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
        await sendMessage(selectedConversationId, {
          content: trimmedContent,
          message_type: "text",
        });

        // Update conversation with new last message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversationId
              ? {
                  ...conv,
                  last_message: {
                    ...optimisticMessage,
                    id: `sent-${Date.now()}`,
                  },
                  updated_at: new Date().toISOString(),
                }
              : conv,
          ),
        );
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
    [selectedConversationId, currentUserId, user?.role],
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchConversations(false);
  }, [fetchConversations]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations(false);
    }, [fetchConversations]),
  );

  // Render empty state for conversation list
  const renderEmptyList = () => (
    <View style={styles.emptyState}>
      <IconSymbol
        name="paperplane.fill"
        size={48}
        color={Colors.light.icon}
        style={{ opacity: 0.5 }}
      />
      <Text style={styles.emptyStateTitle}>No conversations yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start chatting with service providers
      </Text>
    </View>
  );

  // Render empty state for chat
  const renderEmptyChat = () => (
    <View style={styles.emptyChatState}>
      <IconSymbol
        name="paperplane.fill"
        size={64}
        color={Colors.light.icon}
        style={{ opacity: 0.3 }}
      />
      <Text style={styles.emptyChatTitle}>Select a conversation</Text>
      <Text style={styles.emptyChatSubtitle}>
        Choose a conversation from the list to start messaging
      </Text>
    </View>
  );

  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (connectionState === "connected") return null;

    return (
      <View
        style={[
          styles.connectionStatus,
          connectionState === "connecting" && styles.connectingStatus,
        ]}
      >
        <Text style={styles.connectionStatusText}>
          {connectionState === "connecting" ? "Connecting..." : "Disconnected"}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Left Pane - Conversation List */}
      <View
        style={[
          styles.listPane,
          isMobile && showChatOnMobile && styles.hiddenPane,
        ]}
      >
        {/* Header */}
        <View style={styles.listHeader}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.headerActions}>
            {connectionState !== "connected" && renderConnectionStatus()}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={Colors.light.icon}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.light.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <IconSymbol
              name="arrow.left"
              size={20}
              color={Colors.light.icon}
              style={styles.clearIcon}
            />
          )}
        </View>

        {/* Conversation List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          </View>
        ) : filteredConversations.length === 0 ? (
          renderEmptyList()
        ) : (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationListItem
                conversation={item}
                isSelected={item.id === selectedConversationId}
                onPress={() => handleSelectConversation(item.id)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={PRIMARY_COLOR}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>

      {/* Right Pane - Chat */}
      <View
        style={[
          styles.chatPane,
          isMobile && !showChatOnMobile && styles.hiddenPane,
        ]}
      >
        {selectedConversation && selectedPreview ? (
          <>
            {/* Chat Header */}
            <ChatHeader
              name={selectedPreview.other_user_name}
              avatar={selectedPreview.other_user_avatar}
              status={undefined}
              onBack={isMobile ? handleBackToList : undefined}
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
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              </View>
            ) : (
              <ScrollView
                ref={messagesScrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
              >
                {messages.length === 0 ? (
                  <View style={styles.noMessagesState}>
                    <Text style={styles.noMessagesText}>
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
                        highlightQuery={
                          isMessageSearching ? messageSearchQuery : ""
                        }
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
          </>
        ) : (
          renderEmptyChat()
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.light.background,
  },
  // Left Pane Styles
  listPane: {
    width: 350,
    borderRightWidth: 1,
    borderRightColor: "#e9ecef",
    backgroundColor: Colors.light.background,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    backgroundColor: Colors.light.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    margin: 12,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
    transform: [{ rotate: "-45deg" }],
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 4,
  },
  clearIcon: {
    marginLeft: 8,
    transform: [{ rotate: "90deg" }],
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 78,
  },
  // Right Pane Styles
  chatPane: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  // Empty States
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.light.icon,
    marginTop: 8,
    textAlign: "center",
  },
  emptyChatState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    backgroundColor: "#f8f9fa",
  },
  emptyChatTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.light.text,
    marginTop: 24,
  },
  emptyChatSubtitle: {
    fontSize: 15,
    color: Colors.light.icon,
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
    color: Colors.light.icon,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Connection Status
  connectionStatus: {
    backgroundColor: "#dc3545",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  connectingStatus: {
    backgroundColor: "#ffc107",
  },
  connectionStatusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  // Mobile Styles
  hiddenPane: {
    display: "none",
  },
  // Web-specific responsive styles
  ...(Platform.OS === "web" && {
    listPane: {
      width: 350,
      borderRightWidth: 1,
      borderRightColor: "#e9ecef",
      backgroundColor: Colors.light.background,
      // On web, use CSS media queries via inline styles won't work
      // So we handle responsive via JavaScript state
    },
  }),
});
