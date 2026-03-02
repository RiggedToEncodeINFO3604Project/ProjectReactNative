// =====================================================
// = MessageBubble Component                           =
// = Displays a single message bubble with tail        =
// =====================================================

import { Colors } from "@/constants/theme";
import { Message, MessageStatus } from "@/types/scheduling";
import { Image, StyleSheet, Text, View } from "react-native";

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  showStatus?: boolean;
}

const PRIMARY_COLOR = "#0a7ea4";
const RECEIVED_BG = "#e9ecef";
const CHECK_ICON = "✓";
const DOUBLE_CHECK_ICON = "✓✓";

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStatusIcon(status?: MessageStatus): string {
  switch (status) {
    case "sent":
      return CHECK_ICON;
    case "delivered":
      return DOUBLE_CHECK_ICON;
    case "read":
      return DOUBLE_CHECK_ICON;
    default:
      return "";
  }
}

function getStatusColor(status?: MessageStatus): string {
  switch (status) {
    case "read":
      return "#0a7ea4"; // Blue for read
    default:
      return "rgba(255,255,255,0.7)"; // White/gray for others
  }
}

export function MessageBubble({
  message,
  isCurrentUser,
  showStatus = true,
}: MessageBubbleProps) {
  const isImage = message.message_type === "image";
  const statusIcon = getStatusIcon(message.status);
  const statusColor = getStatusColor(message.status);

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isCurrentUser ? styles.sentBubble : styles.receivedBubble,
          isImage && styles.imageBubble,
        ]}
      >
        {/* Tail for WhatsApp-style bubbles */}
        <View
          style={[
            styles.tail,
            isCurrentUser ? styles.sentTail : styles.receivedTail,
          ]}
        />

        {isImage && message.image_url ? (
          <Image source={{ uri: message.image_url }} style={styles.image} />
        ) : (
          <Text
            style={[
              styles.content,
              isCurrentUser ? styles.sentContent : styles.receivedContent,
            ]}
          >
            {message.content}
          </Text>
        )}

        {/* Timestamp and status row */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.timestamp,
              isCurrentUser ? styles.sentTimestamp : styles.receivedTimestamp,
            ]}
          >
            {formatTime(message.created_at)}
          </Text>
          {isCurrentUser && showStatus && (
            <Text style={[styles.statusIcon, { color: statusColor }]}>
              {statusIcon}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  sentContainer: {
    alignSelf: "flex-end",
    marginRight: 8,
  },
  receivedContainer: {
    alignSelf: "flex-start",
    marginLeft: 8,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "relative",
  },
  sentBubble: {
    backgroundColor: PRIMARY_COLOR,
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: RECEIVED_BG,
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tail: {
    position: "absolute",
    bottom: 0,
    width: 16,
    height: 16,
    backgroundColor: "transparent",
  },
  sentTail: {
    right: -8,
    borderBottomLeftRadius: 16,
    borderLeftWidth: 8,
    borderLeftColor: PRIMARY_COLOR,
    borderBottomWidth: 8,
    borderBottomColor: PRIMARY_COLOR,
    borderRightWidth: 8,
    borderRightColor: "transparent",
    borderTopWidth: 8,
    borderTopColor: "transparent",
  },
  receivedTail: {
    left: -8,
    borderBottomRightRadius: 16,
    borderRightWidth: 8,
    borderRightColor: RECEIVED_BG,
    borderBottomWidth: 8,
    borderBottomColor: RECEIVED_BG,
    borderLeftWidth: 8,
    borderLeftColor: "transparent",
    borderTopWidth: 8,
    borderTopColor: "transparent",
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
  },
  sentContent: {
    color: "#fff",
  },
  receivedContent: {
    color: Colors.light.text,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
    resizeMode: "cover",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  sentTimestamp: {
    color: "rgba(255,255,255,0.7)",
  },
  receivedTimestamp: {
    color: Colors.light.icon,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: -1,
  },
});

export default MessageBubble;
