import React from "react";
import { StyleSheet, Text } from "react-native";

interface Props {
  status: "sending" | "sent" | "delivered" | "read" | "failed";
}

const MessageStatusIndicator: React.FC<Props> = ({ status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case "sending":
        return "○"; // Empty circle
      case "sent":
        return "✓"; // Single checkmark
      case "delivered":
        return "✓✓"; // Double checkmark (gray)
      case "read":
        return "✓✓"; // Double checkmark (blue)
      case "failed":
        return "⚠️";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "read":
        return "#4A9EFF"; // Blue
      case "failed":
        return "#FF4444"; // Red
      default:
        return "#999999"; // Gray
    }
  };

  return (
    <Text style={[styles.status, { color: getStatusColor() }]}>
      {getStatusIcon()}
    </Text>
  );
};

const styles = StyleSheet.create({
  status: {
    fontSize: 12,
    marginLeft: 4,
  },
});

export default MessageStatusIndicator;
