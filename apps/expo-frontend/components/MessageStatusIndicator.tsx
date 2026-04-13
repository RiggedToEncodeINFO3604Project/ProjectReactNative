import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface Props {
  status: "sending" | "sent" | "delivered" | "read" | "failed";
}

const MessageStatusIndicator: React.FC<Props> = ({ status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case "sending":
        return "🕐"; // Clock icon for sending
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
      case "sending":
        return "#FFA500"; // Orange
      default:
        return "#999999"; // Gray
    }
  };

  // For sending status, show a spinner
  if (status === "sending") {
    return (
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size="small" color={getStatusColor()} />
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          Sending
        </Text>
      </View>
    );
  }

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
  spinnerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 10,
    marginLeft: 4,
  },
});

export default MessageStatusIndicator;
