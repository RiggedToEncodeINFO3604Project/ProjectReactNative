// =====================================================
// = Messages/Inbox Screen - Provider                  =
// = Shows conversation list only                      =
// =====================================================

import { ConversationListItem } from "@/components/messaging/ConversationListItem";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { getConversations, messagingSocket } from "@/services/messagingApi";
import { Conversation, ConversationPreview, Message } from "@/types/scheduling";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const PRIMARY_COLOR = "#0a7ea4";

// Convert Conversation to ConversationPreview format
function toConversationPreview(
  conversation: Conversation,
  currentUserId: string,
): ConversationPreview {
  const otherUserName = conversation.customer_name || "Customer";
  const otherUserAvatar = conversation.customer_avatar;
  const unreadCount = conversation.unread_count_provider;

  return {
    id: conversation.id,
    other_user_name: otherUserName,
    other_user_avatar: otherUserAvatar,
    other_user_id: conversation.customer_id,
    other_user_role: "Customer",
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
  const router = useRouter();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<
    ConversationPreview[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");

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

  // Handle new message from WebSocket
  const handleNewMessage = useCallback(
    (message: Message) => {
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
    [currentUserId],
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

  // Handle conversation selection - navigate to chat screen
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      router.push(`/messages/${conversationId}`);
    },
    [router],
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
        Start chatting with your customers
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
      {/* Header */}
      <View style={styles.header}>
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
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <IconSymbol
              name="xmark.circle.fill"
              size={20}
              color={Colors.light.icon}
              style={styles.clearIcon}
            />
          </TouchableOpacity>
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
              isSelected={false}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
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
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 4,
  },
  clearIcon: {
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 78,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
});
