import { useAuth } from "@/context/AuthContext";
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

export default function ProviderHomeScreen() {
  const { isDarkMode } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    // Navigation will be handled by auth state change
  };

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    error: "#FF3B30",
  };

  const menuItems = [
    {
      title: "📅 Manage Availability",
      description: "Set your weekly schedule and available time slots",
      route: "availability",
    },
    {
      title: "💼 Manage Services",
      description: "Add or update the services you offer",
      route: "services",
    },
    {
      title: "📋 Pending Bookings",
      description: "Review and approve booking requests",
      route: "pending",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Provider Dashboard
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.error }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={[styles.menuTitle, { color: colors.accent }]}>
              {item.title}
            </Text>
            <Text style={[styles.menuDescription, { color: colors.textMuted }]}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    fontSize: 24,
    fontWeight: "bold",
  },
  logoutText: {
    fontSize: 16,
  },
  content: {
    padding: 15,
  },
  menuCard: {
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  menuDescription: {
    fontSize: 14,
  },
});
