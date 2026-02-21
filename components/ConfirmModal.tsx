import { useTheme } from "@/context/ThemeContext";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmStyle = "primary",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  const { isDarkMode } = useTheme();

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    danger: "#FF3B30",
    buttonBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
  };

  const confirmBackgroundColor =
    confirmStyle === "danger" ? colors.danger : colors.accent;
  const confirmTextColor = confirmStyle === "danger" ? "#ffffff" : "#151718";

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {title}
          </Text>

          <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
            {message}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: colors.buttonBg },
              ]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: confirmBackgroundColor },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={confirmTextColor} />
              ) : (
                <Text
                  style={[
                    styles.confirmButtonText,
                    { color: confirmTextColor },
                  ]}
                >
                  {confirmText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    width: "85%",
    maxWidth: 360,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
