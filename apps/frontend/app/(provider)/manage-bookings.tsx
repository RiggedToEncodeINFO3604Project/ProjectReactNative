import BackButton from "@/components/BackButton";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ManageBookingsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const handleNavigateToPending = () => {
    router.push("/pending");
  };

  const handleNavigateToConfirmed = () => {
    router.push("/confirmed");
  };

  const handleBackPress = () => {
    router.replace("/");
  };

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: SharedColours.bookingStatus.pending,
  };

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colours.card, borderBottomColor: colours.border },
        ]}
      >
        <BackButton onPress={handleBackPress} />
        <Text style={[styles.title, { color: colours.text }]}>
          Manage Bookings
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colours.card, borderColor: colours.border },
          ]}
          onPress={handleNavigateToPending}
        >
          <Text style={[styles.optionIcon, { color: colours.accent }]}>📋</Text>
          <Text style={[styles.optionTitle, { color: colours.text }]}>
            View Pending Booking Requests
          </Text>
          <Text style={[styles.optionDescription, { color: colours.textMuted }]}>
            Review, accept, or reject incoming booking requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: colours.card, borderColor: colours.border },
          ]}
          onPress={handleNavigateToConfirmed}
        >
          <Text style={[styles.optionIcon, { color: colours.accent }]}>✅</Text>
          <Text style={[styles.optionTitle, { color: colours.text }]}>
            View Confirmed Bookings
          </Text>
          <Text style={[styles.optionDescription, { color: colours.textMuted }]}>
            View, reschedule, or delete confirmed bookings
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
