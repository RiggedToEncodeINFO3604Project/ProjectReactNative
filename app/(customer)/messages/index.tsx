// =====================================================
// = Messages/Inbox Screen - Customer                  =
// = Shows conversation list only                      =
// =====================================================

import BackButton from "@/components/BackButton";
import { ConversationListItem } from "@/components/messaging/ConversationListItem";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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

// Convert Conversation to ConversationPreview format
function toConversationPreview(
  conversation: Conversation,
  currentUserId: string,
): ConversationPreview {
  const otherUserName = conversation.provider_name || "Provider";
  const otherUserAvatar = conversation.provider_avatar;
  const unreadCount = conversation.unread_count;

  const lastMessageContent =
    conversation.last_message?.message_type === "image"
      ? conversation.last_message.content?.trim()
        ? `Photo: ${conversation.last_message.content.trim()}`
        : "Photo"
      : conversation.last_message?.content;

  return {
    id: conversation.id,
    other_user_name: otherUserName,
    other_user_avatar: otherUserAvatar,
    other_user_id: conversation.provider_id,
    other_user_role: "Provider",
    last_message_content: lastMessageContent,
    last_message_time: conversation.last_message?.created_at,
    unread_count: unreadCount,
    is_last_message_from_me:
      conversation.last_message?.sender_id === currentUserId,
  };
}

export default function MessagesScreen() {
  const { token, user } = useAuth();
  const { colours: theme, isDarkMode } = useTheme();
  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];
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
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setConversations([]);
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
                unread_count:
                  message.sender_role === "Provider"
                    ? (conv.unread_count || 0) + 1
                    : conv.unread_count,
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
    (
      state:
        | "connected"
        | "disconnected"
        | "connecting"
        | "reconnecting"
        | "fallback_polling",
    ) => {
      if (state === "reconnecting") {
        setConnectionState("connecting");
      } else if (state === "fallback_polling") {
        setConnectionState("disconnected");
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
    const previews = Array.isArray(conversations)
      ? conversations.map((conv) => toConversationPreview(conv, currentUserId))
      : [];

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
        color={theme.icon}
        style={{ opacity: 0.5 }}
      />
      <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
        No conversations yet
      </Text>
      <Text style={[styles.emptyStateSubtitle, { color: theme.icon }]}>
        Start chatting with service providers
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
            styles.header,
            {
              backgroundColor: theme.background,
              borderBottomColor: extendedColours.borderAlt,
            },
          ]}
      >
        <BackButton onPress={() => router.back()} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Messages
        </Text>
        <View style={styles.headerActions}>
          {connectionState !== "connected" && renderConnectionStatus()}
        </View>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: extendedColours.searchBg },
        ]}
      >
        <IconSymbol
          name="magnifyingglass"
          size={20}
          color={theme.icon}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search conversations..."
          placeholderTextColor={theme.icon}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <IconSymbol
              name="xmark.circle.fill"
              size={20}
              color={theme.icon}
              style={styles.clearIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Conversation List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
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
              tintColor={theme.tint}
            />
          }
          ItemSeparatorComponent={() => (
            <View
              style={[
                styles.separator,
                {
                  backgroundColor: extendedColours.searchInputBg,
                },
              ]}
            />
          )}
          ListEmptyComponent={renderEmptyList}
          ListFooterComponent={() => (
            <>
              {filteredConversations.length > 0 && (
                <View
                  style={[
                    styles.separator,
                    styles.aiSupportSeparator,
                    {
                      backgroundColor: extendedColours.borderAlt,
                    },
                  ]}
                />
              )}
              <TouchableOpacity
                style={[
                  styles.aiSupportContainer,
                  { backgroundColor: theme.background },
                ]}
                onPress={() => router.push("/support")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.aiSupportIcon,
                    {
                      backgroundColor: extendedColours.selectedBg,
                    },
                  ]}
                >
                  <IconSymbol name="robot.fill" size={28} color={theme.tint} />
                </View>
                <View style={styles.aiSupportContent}>
                  <Text
                    style={[styles.aiSupportName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    AI Support
                  </Text>
                  <Text
                    style={[styles.aiSupportSubtitle, { color: theme.icon }]}
                    numberOfLines={1}
                  >
                    Get help from our smart assistant
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.icon} />
              </TouchableOpacity>
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
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
    margin: 12,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  clearIcon: {
    marginLeft: 8,
  },
  separator: {
    height: 1,
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
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  connectionStatus: {
    backgroundColor: SharedColours.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  connectingStatus: {
    backgroundColor: SharedColours.warningAlt,
  },
  connectionStatusText: {
    color: SharedColours.white,
    fontSize: 11,
    fontWeight: "600",
  },
  aiSupportSeparator: {
    height: 2,
    marginLeft: 0,
  },
  aiSupportContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aiSupportIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  aiSupportContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  aiSupportName: {
    fontSize: 16,
    fontWeight: "600",
  },
  aiSupportSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
