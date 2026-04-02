import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
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

export default function ProviderHomeScreen() {
  const { isDarkMode, colours: themeColours } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await logout();
    // Navigation will be handled by auth state change
  };

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: themeColours.primary,
    error: SharedColours.error,
  };

  const handleSettingsPress = () => {
    router.push("/settings");
  };

  const menuItems = [
    {
      title: "Manage Services & Availability",
      description:
        "Set your services, weekly schedule and available time slots",
      route: "manage-sa",
      icon: "settings-outline" as const,
    },
    {
      title: "Manage Bookings",
      description:
        "View and manage your booking requests and confirmed bookings",
      route: "manage-bookings",
      icon: "calendar-outline" as const,
    },
    {
      title: "View Your Calendar",
      description: "See all your scheduled appointments",
      route: "calendar",
      icon: "calendar-outline" as const,
    },
    {
      title: "Auto-Tagging Settings",
      description:
        "Configure automatic customer tagging and behavioral insights",
      route: "manage-tagging",
      icon: "pricetag-outline" as const,
    },
    {
      title: "Messages",
      description: "View and respond to messages from your customers",
      route: "/messages",
      icon: "chatbubble-outline" as const,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colours.card,
            borderBottomColor: colours.border,
            paddingTop: 20,
          },
        ]}
      >
        <Text style={[styles.title, { color: colours.text }]}>
          Provider Dashboard
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleSettingsPress}
            style={styles.settingsButton}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <IconSymbol name="gearshape.fill" size={24} color={colours.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={[styles.logoutText, { color: colours.error }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuCard,
              { backgroundColor: colours.card, borderColor: colours.border },
            ]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuCardHeader}>
              <Ionicons
                name={item.icon}
                size={24}
                color={colours.accent}
                style={styles.menuIcon}
              />
              <Text style={[styles.menuTitle, { color: colours.accent }]}>
                {item.title}
              </Text>
            </View>
            <Text style={[styles.menuDescription, { color: colours.textMuted }]}>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  settingsButton: {
    padding: 4,
  },
  logoutButton: {
    padding: 4,
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
  menuCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  menuDescription: {
    fontSize: 14,
  },
});
