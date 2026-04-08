// =====================================================
// = MessageBubble Component                           =
// = Displays a single message bubble with tail        =
// =====================================================

import {
  CustomerColours,
  getExtendedColours,
  getThemeColours,
  ProviderColours,
  SharedColours,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Message, MessageStatus } from "@/types/scheduling";
import { formatDateTimeTime } from "@/utils/time";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  showStatus?: boolean;
  highlightQuery?: string;
  isHighlighted?: boolean;
  onRetry?: (messageId: string) => void; // Callback for retry on failed messages
}

const CHECK_ICON = "✓";
const DOUBLE_CHECK_ICON = "✓✓";
const HIGHLIGHT_COLOR = SharedColours.highlight; // Yellow highlight
const FAILED_ICON = "⚠️";
const SENDING_ICON = "🕐";

function getStatusIcon(status?: MessageStatus): {
  icon: string;
  showSpinner: boolean;
} {
  switch (status) {
    case "sending":
      return { icon: SENDING_ICON, showSpinner: true };
    case "sent":
      return { icon: CHECK_ICON, showSpinner: false };
    case "delivered":
      return { icon: DOUBLE_CHECK_ICON, showSpinner: false };
    case "read":
      return { icon: DOUBLE_CHECK_ICON, showSpinner: false };
    case "failed":
      return { icon: FAILED_ICON, showSpinner: false };
    default:
      return { icon: "", showSpinner: false };
  }
}

function getStatusColor(
  status?: MessageStatus,
  tintColor: string = "#0a7ea4",
): string {
  switch (status) {
    case "read":
      return tintColor; // Use theme tint for read
    case "failed":
      return "#FF4444"; // Red for failed
    case "sending":
      return "#FFA500"; // Orange for sending
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

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, "gi"));

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
  onRetry,
}: MessageBubbleProps) {
  const { isDarkMode, userType, colours: theme } = useTheme();
  const extendedColours = getExtendedColours(isDarkMode);
  const userTypeTheme = getThemeColours(userType, isDarkMode);
  const isImage = message.message_type === "image";
  const { icon: statusIcon, showSpinner } = getStatusIcon(message.status);
  const statusColor = getStatusColor(message.status, theme.tint);
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  const handleRetry = () => {
    if (onRetry && isFailed) {
      onRetry(message.id);
    }
  };

  // Get user's primary color based on userType
  const userPrimaryColor =
    userType === "provider"
      ? ProviderColours.light.primary // Provider: #01d0a8 (teal)
      : CustomerColours.light.primary; // Customer: #1e4e8c (blue)
  const otherBubbleColor = "#f0c85a"; // Yellow for other person in both modes
  const bubbleColor = isCurrentUser ? userPrimaryColor : otherBubbleColor;

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
          isCurrentUser ? styles.sentBubble : styles.receivedBubble,
          {
            backgroundColor: bubbleColor,
          },
          isImage && styles.imageBubble,
          isHighlighted && styles.highlightedBubble,
          isFailed && styles.failedBubble,
        ]}
      >
        {/* Tail for WhatsApp-style bubbles */}
        <View
          style={[
            styles.tail,
            isCurrentUser ? styles.sentTail : styles.receivedTail,
            {
              borderLeftColor: bubbleColor,
              borderBottomColor: bubbleColor,
              borderRightColor: bubbleColor,
            },
            isHighlighted &&
              (isCurrentUser
                ? styles.highlightedSentTail
                : styles.highlightedReceivedTail),
          ]}
        />

        {isImage && message.image_url ? (
          <View style={styles.imageContent}>
            <Image source={{ uri: message.image_url }} style={styles.image} />
            {!!message.content?.trim() && (
              <Text
                style={[
                  styles.imageCaption,
                  { color: bubbleColor === otherBubbleColor ? "#000" : "#fff" },
                ]}
              >
                {message.content.trim()}
              </Text>
            )}
          </View>
        ) : (
          <HighlightedText
            text={message.content}
            highlight={highlightQuery}
            style={[
              styles.content,
              // Use white text for primary color bubbles, black for yellow bubbles
              { color: bubbleColor === otherBubbleColor ? "#000" : "#fff" },
            ]}
            highlightStyle={styles.highlightText}
          />
        )}

        {/* Timestamp and status row */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.timestamp,
              // Use darker color for yellow bubble, lighter for primary color bubble
              {
                color:
                  bubbleColor === otherBubbleColor
                    ? "rgba(0,0,0,0.6)"
                    : isCurrentUser
                      ? "rgba(255,255,255,0.7)"
                      : theme.icon,
              },
            ]}
          >
            {formatDateTimeTime(message.created_at)}
          </Text>
          {isCurrentUser && showStatus && (
            <View style={styles.statusContainer}>
              {showSpinner ? (
                <ActivityIndicator
                  size="small"
                  color={statusColor}
                  style={styles.spinner}
                />
              ) : (
                <>
                  {isFailed && onRetry ? (
                    <TouchableOpacity
                      onPress={handleRetry}
                      style={styles.retryButton}
                    >
                      <Text style={[styles.statusIcon, { color: statusColor }]}>
                        {statusIcon}
                      </Text>
                      <Text style={[styles.retryText, { color: statusColor }]}>
                        Tap to retry
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.statusIcon, { color: statusColor }]}>
                      {statusIcon}
                    </Text>
                  )}
                </>
              )}
            </View>
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
  failedBubble: {
    borderWidth: 1,
    borderColor: "#FF4444",
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
  imageContent: {
    gap: 8,
  },
  imageCaption: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingBottom: 4,
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
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: -1,
  },
  spinner: {
    marginRight: 2,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  retryText: {
    fontSize: 10,
    marginLeft: 2,
  },
});

export default MessageBubble;
