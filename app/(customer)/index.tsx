import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExtendedColors, SharedColors, UIColors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { searchProviders } from "@/services/schedulingApi";
import { ProviderSearchResult } from "@/types/scheduling";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CustomerHomeScreen() {
  const { isDarkMode, colors: themeColors } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [providers, setProviders] = useState<ProviderSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await searchProviders(searchQuery || null, null);
      setProviders(results);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to search providers",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    // Navigation will be handled by auth state change in root layout
  };

  const handleViewBookings = () => {
    router.push("bookings" as never);
  };

  const handleViewMessages = () => {
    router.push("/messages" as never);
  };

  const handleProviderPress = (provider: ProviderSearchResult) => {
    router.push(
      `provider/${provider.id}?provider=${encodeURIComponent(JSON.stringify(provider))}` as never,
    );
  };

  const extendedColors = ExtendedColors[isDarkMode ? "dark" : "light"];

  const colors = {
    background: extendedColors.background,
    card: extendedColors.card,
    text: extendedColors.text,
    textMuted: extendedColors.textMuted,
    border: extendedColors.border,
    accent: themeColors.primary,
    inputBg: extendedColors.inputBg,
    error: SharedColors.error,
    success: themeColors.primary,
  };

  const handleSettingsPress = () => {
    router.push("/settings");
  };

  const renderProvider = ({ item }: { item: ProviderSearchResult }) => (
    <TouchableOpacity
      style={[
        styles.providerCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => handleProviderPress(item)}
    >
      <Text style={[styles.providerName, { color: colors.text }]}>
        {item.provider_name}
      </Text>
      <Text style={[styles.businessName, { color: colors.textMuted }]}>
        {item.business_name}
      </Text>
      <Text
        style={[styles.providerBio, { color: colors.textMuted }]}
        numberOfLines={2}
      >
        {item.bio}
      </Text>
      <Text style={[styles.providerAddress, { color: colors.textMuted }]}>
        {item.provider_address}
      </Text>
      <View style={styles.servicesContainer}>
        <Text style={[styles.servicesLabel, { color: colors.text }]}>
          Services:
        </Text>
        {item.services.map((service) => (
          <Text
            key={service.id}
            style={[styles.serviceName, { color: colors.textMuted }]}
          >
            • {service.name} - ${service.price}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: 20,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Find Providers
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleSettingsPress}
            style={styles.settingsButton}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <IconSymbol name="gearshape.fill" size={24} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={[styles.logoutText, { color: colors.error }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.inputBg,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Search by name or Provider ID"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.accent }]}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dashboardButtonsContainer}>
        <TouchableOpacity
          style={[styles.dashboardButton, { backgroundColor: colors.success }]}
          onPress={handleViewBookings}
        >
          <Text
            style={[
              styles.dashboardButtonText,
              { color: UIColors.button.textLight },
            ]}
          >
            My Bookings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dashboardButton, { backgroundColor: colors.accent }]}
          onPress={handleViewMessages}
        >
          <Text
            style={[
              styles.dashboardButtonText,
              { color: UIColors.button.textLight },
            ]}
          >
            Messages
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={providers}
          renderItem={renderProvider}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {searchQuery ? "No providers found" : "Search for providers"}
            </Text>
          }
        />
      )}
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
  searchContainer: {
    flexDirection: "row",
    padding: 15,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginRight: 10,
  },
  searchButton: {
    padding: 12,
    borderRadius: 8,
    justifyContent: "center",
  },
  searchButtonText: {
    color: UIColors.button.textLight,
    fontSize: 16,
    fontWeight: "600",
  },
  dashboardButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
    marginBottom: 10,
    gap: 10,
  },
  dashboardButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  dashboardButtonText: {
    color: SharedColors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    padding: 15,
  },
  providerCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  providerName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  businessName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 5,
  },
  providerBio: {
    fontSize: 14,
    marginBottom: 5,
  },
  providerAddress: {
    fontSize: 14,
    marginBottom: 10,
  },
  servicesContainer: {
    marginTop: 10,
  },
  servicesLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 5,
  },
  serviceName: {
    fontSize: 14,
    marginLeft: 10,
  },
  loader: {
    marginTop: 50,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 50,
  },
});
