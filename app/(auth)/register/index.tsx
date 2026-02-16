import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function RegisterChoiceScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const colors = {
    background: isDarkMode ? "#151718" : "#ffffff",
    card: isDarkMode ? "#1e2333" : "#f8f9fa",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.brandName, { color: colors.accent }]}>
        SkeduleIt
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Choose your account type
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/register/customer")}
        >
          <Text style={styles.optionIcon}>👤</Text>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            Customer
          </Text>
          <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
            Book appointments with service providers, manage your bookings, and
            discover new services.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/register/provider")}
        >
          <Text style={styles.optionIcon}>💼</Text>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            Provider
          </Text>
          <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
            Offer your services, manage availability, and handle customer
            bookings.
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.backLink, { color: colors.accent }]}>
          ← Back to Login
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: "center",
    paddingTop: 60,
  },
  brandName: {
    fontFamily: "serif",
    fontSize: 48,
    fontWeight: "400",
    marginBottom: 8,
    textShadowColor: "#f0c85a",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  optionsContainer: {
    width: "100%",
    maxWidth: 400,
    gap: 16,
  },
  optionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  backLink: {
    fontSize: 16,
    marginTop: 32,
  },
});
