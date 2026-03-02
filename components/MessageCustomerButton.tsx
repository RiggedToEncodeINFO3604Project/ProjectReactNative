import { useTheme } from "@/context/ThemeContext";
import { startConversation } from "@/services/messagingApi";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface MessageCustomerButtonProps {
  customerId: string;
  customerName?: string;
  size?: "small" | "medium";
  showLabel?: boolean;
  style?: object;
}

// Reusable button component to start a conversation with a customer

export function MessageCustomerButton({
  customerId,
  customerName,
  size = "small",
  showLabel = true,
  style,
}: MessageCustomerButtonProps) {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const colors = {
    background: isDarkMode ? "#2a2f3e" : "#f0f0f0",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    accent: "#f0c85a",
    border: isDarkMode ? "#3a3f4e" : "#dee2e6",
  };

  const handleMessagePress = async () => {
    if (!customerId) {
      Alert.alert("Error", "Customer information not available");
      return;
    }

    setLoading(true);
    try {
      const result = await startConversation(customerId);
      const conversationId = result.conversation_id;

      // Navigate to messages screen with the conversation
      router.push({
        pathname: "/messages",
        params: {
          conversationId,
          recipientName: customerName || "Customer",
        },
      });
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to start conversation",
      );
    } finally {
      setLoading(false);
    }
  };

  const buttonSize =
    size === "small" ? styles.smallButton : styles.mediumButton;
  const textSize = size === "small" ? styles.smallText : styles.mediumText;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        buttonSize,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
        style,
      ]}
      onPress={handleMessagePress}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.icon, { color: colors.accent }]}>💬</Text>
          {showLabel && (
            <Text style={[textSize, { color: colors.text }]}>Message</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  mediumButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  smallText: {
    fontSize: 14,
    fontWeight: "500",
  },
  mediumText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default MessageCustomerButton;
