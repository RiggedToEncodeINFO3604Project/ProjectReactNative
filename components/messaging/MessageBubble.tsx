// =====================================================
// = MessageBubble Component                           =
// = Displays a single message bubble with tail        =
// =====================================================

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Message, MessageStatus } from "@/types/scheduling";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  showStatus?: boolean;
  highlightQuery?: string;
  isHighlighted?: boolean;
}

const CHECK_ICON = "✓";
const DOUBLE_CHECK_ICON = "✓✓";
const HIGHLIGHT_COLOR = "#ffeb3b"; // Yellow highlight

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

function getStatusColor(
  status?: MessageStatus,
  tintColor: string = "#0a7ea4",
): string {
  switch (status) {
    case "read":
      return tintColor; // Use theme tint for read
    default:
      return "rgba(255,255,255,0.7)"; // White/gray for others
  }
}

// Function to split text and wrap matching parts with highlight
function HighlightedText({
  text,
  highlight,
  style,
  highlightStyle,
}: {
  text: string;
  highlight?: string;
  style: any;
  highlightStyle: any;
}) {
  if (!highlight || highlight.trim() === "") {
    return <Text style={style}>{text}</Text>;
  }

  const parts = text.split(
    new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === highlight.toLowerCase();
        return isMatch ? (
          <Text key={index} style={highlightStyle}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        );
      })}
    </Text>
  );
}

export function MessageBubble({
  message,
  isCurrentUser,
  showStatus = true,
  highlightQuery = "",
  isHighlighted = false,
}: MessageBubbleProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isImage = message.message_type === "image";
  const statusIcon = getStatusIcon(message.status);
  const statusColor = getStatusColor(message.status, theme.tint);

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
        isHighlighted && styles.highlightedContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isCurrentUser
            ? [
                styles.sentBubble,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#0a7ea4" : theme.tint,
                },
              ]
            : [
                styles.receivedBubble,
                {
                  backgroundColor:
                    colorScheme === "dark" ? "#2a2a2a" : "#e9ecef",
                },
              ],
          isImage && styles.imageBubble,
          isHighlighted && styles.highlightedBubble,
        ]}
      >
        {/* Tail for WhatsApp-style bubbles */}
        <View
          style={[
            styles.tail,
            isCurrentUser
              ? [
                  styles.sentTail,
                  {
                    borderLeftColor:
                      colorScheme === "dark" ? "#0a7ea4" : theme.tint,
                    borderBottomColor:
                      colorScheme === "dark" ? "#0a7ea4" : theme.tint,
                  },
                ]
              : [
                  styles.receivedTail,
                  {
                    borderRightColor:
                      colorScheme === "dark" ? "#2a2a2a" : "#e9ecef",
                    borderBottomColor:
                      colorScheme === "dark" ? "#2a2a2a" : "#e9ecef",
                  },
                ],
            isHighlighted &&
              (isCurrentUser
                ? styles.highlightedSentTail
                : styles.highlightedReceivedTail),
          ]}
        />

        {isImage && message.image_url ? (
          <Image source={{ uri: message.image_url }} style={styles.image} />
        ) : (
          <HighlightedText
            text={message.content}
            highlight={highlightQuery}
            style={[
              styles.content,
              isCurrentUser ? { color: "#fff" } : { color: theme.text },
            ]}
            highlightStyle={styles.highlightText}
          />
        )}

        {/* Timestamp and status row */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.timestamp,
              isCurrentUser ? styles.sentTimestamp : { color: theme.icon },
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
  highlightedContainer: {
    // Add subtle scale or shadow for highlighted messages
    transform: [{ scale: 1.02 }],
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "relative",
  },
  sentBubble: {
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    borderBottomLeftRadius: 4,
  },
  highlightedBubble: {
    borderWidth: 2,
    borderColor: HIGHLIGHT_COLOR,
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
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderRightColor: "transparent",
    borderTopWidth: 8,
    borderTopColor: "transparent",
  },
  receivedTail: {
    left: -8,
    borderBottomRightRadius: 16,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderLeftColor: "transparent",
    borderTopWidth: 8,
    borderTopColor: "transparent",
  },
  highlightedSentTail: {
    borderLeftColor: HIGHLIGHT_COLOR,
    borderBottomColor: HIGHLIGHT_COLOR,
  },
  highlightedReceivedTail: {
    borderRightColor: HIGHLIGHT_COLOR,
    borderBottomColor: HIGHLIGHT_COLOR,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
  },
  highlightText: {
    backgroundColor: HIGHLIGHT_COLOR,
    color: "#000",
    borderRadius: 2,
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
  statusIcon: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: -1,
  },
});

export default MessageBubble;
