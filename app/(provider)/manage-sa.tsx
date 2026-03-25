import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ManageSAScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={[styles.backText, { color: colors.accent }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Manage Services & Availability
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/services")}
        >
          <Text style={[styles.optionIcon, { color: colors.accent }]}>💼</Text>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            Manage Services
          </Text>
          <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
            Add, edit, or remove the services you offer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/availability")}
        >
          <Text style={[styles.optionIcon, { color: colors.accent }]}>📅</Text>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            Manage Availability
          </Text>
          <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
            Set your weekly schedule and available time slots
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  backText: {
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  content: {
    padding: 20,
    gap: 20,
  },
  optionCard: {
    padding: 25,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    textAlign: "center",
  },
});
