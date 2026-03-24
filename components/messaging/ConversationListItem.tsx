// =====================================================
// = ConversationListItem Component                    =
// = Displays a conversation in the inbox list         =
// =====================================================

import { getExtendedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { ConversationPreview } from "@/types/scheduling";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "./Avatar";

interface ConversationListItemProps {
  conversation: ConversationPreview;
  isSelected?: boolean;
  onPress: () => void;
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function truncateMessage(message: string, maxLength: number = 40): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength).trim() + "...";
}

export function ConversationListItem({
  conversation,
  isSelected = false,
  onPress,
}: ConversationListItemProps) {
  const { isDarkMode } = useTheme();
  const extendedColours = getExtendedColours(isDarkMode);
  const hasUnread = conversation.unread_count > 0;

  // Format preview text
  let previewText = "";
  if (conversation.last_message_content) {
    const prefix = conversation.is_last_message_from_me ? "You: " : "";
    previewText = prefix + truncateMessage(conversation.last_message_content);
  } else {
    previewText = "No messages yet";
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: extendedColours.background },
        isSelected && {
          backgroundColor: extendedColours.selectedBg,
        },
      ]}
      android_ripple={{
        color: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      }}
    >
      <Avatar
        uri={conversation.other_user_avatar}
        name={conversation.other_user_name}
        size="medium"
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.name,
              { color: extendedColours.text },
              hasUnread && styles.unreadName,
            ]}
            numberOfLines={1}
          >
            {conversation.other_user_name}
          </Text>
          {conversation.last_message_time && (
            <Text
              style={[
                styles.timestamp,
                { color: extendedColours.textSecondary },
                hasUnread && { color: extendedColours.text, fontWeight: "600" },
              ]}
            >
              {formatTimestamp(conversation.last_message_time)}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text
            style={[
              styles.preview,
              { color: extendedColours.textSecondary },
              hasUnread && { color: extendedColours.text, fontWeight: "500" },
            ]}
            numberOfLines={1}
          >
            {previewText}
          </Text>

          {hasUnread && (
            <View
              style={[styles.badge, { backgroundColor: extendedColours.text }]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: extendedColours.background },
                ]}
              >
                {conversation.unread_count > 99
                  ? "99+"
                  : conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  unreadName: {
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preview: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

export default ConversationListItem;
