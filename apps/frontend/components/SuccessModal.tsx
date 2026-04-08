import { ExtendedColours, SharedColours, UIColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface SuccessModalProps {
  visible: boolean;
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function SuccessModal({
  visible,
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 2500,
}: SuccessModalProps) {
  const { isDarkMode } = useTheme();

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    card: extendedColours.card,
    text: extendedColours.text,
  };

  React.useEffect(() => {
    if (visible && autoClose) {
      const timer = setTimeout(() => {
        onClose?.();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, autoCloseDelay, onClose]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.successModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.successModalContent, { backgroundColor: colours.card }]}
        >
          <View style={styles.successCircle}>
            <Text style={styles.successCheckmark}>✓</Text>
          </View>
          <Text style={[styles.successMessage, { color: colours.text }]}>
            {message}
          </Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  successModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: UIColours.overlay,
  },
  successModalContent: {
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: UIColours.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SharedColours.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successCheckmark: {
    fontSize: 40,
    color: SharedColours.white,
    fontWeight: "bold",
  },
  successMessage: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
