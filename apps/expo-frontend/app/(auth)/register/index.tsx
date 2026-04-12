import BackButton from "@/components/BackButton";
import { getScreenPalette } from "@/constants/theme";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterChoiceScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const colours = getScreenPalette(isDarkMode, { cardTone: "alt" });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colours.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 24) + 24,
          paddingBottom: Math.max(insets.bottom, 24),
          paddingLeft: 20 + insets.left,
          paddingRight: 20 + insets.right,
        },
      ]}
    >
      <Text style={[styles.brandName, { color: colours.accent }]}>
        SkeduleIt
      </Text>
      <Text style={[styles.subtitle, { color: colours.textMuted }]}>
        Choose your account type
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colours.card, borderColor: colours.border },
          ]}
          onPress={() => router.push("register/customer" as never)}
        >
          <Text style={styles.optionIcon}>👤</Text>
          <Text style={[styles.optionTitle, { color: colours.text }]}>
            Customer
          </Text>
          <Text style={[styles.optionDescription, { color: colours.textMuted }]}>
            Book appointments with service providers, manage your bookings, and
            discover new services.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colours.card, borderColor: colours.border },
          ]}
          onPress={() => router.push("register/provider" as never)}
        >
          <Text style={styles.optionIcon}>💼</Text>
          <Text style={[styles.optionTitle, { color: colours.text }]}>
            Provider
          </Text>
          <Text style={[styles.optionDescription, { color: colours.textMuted }]}>
            Offer your services, manage availability, and handle customer
            bookings.
          </Text>
        </TouchableOpacity>
      </View>

      <BackButton
        onPress={() => router.back()}
        label="Back to Login"
        style={styles.backLink}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: "center",
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
    marginTop: 32,
  },
});
