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

export default function CustomerHomeScreen() {
  const { isDarkMode } = useTheme();
  const { logout, user } = useAuth();
  const router = useRouter();

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
    router.replace("/login");
  };

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    inputBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
    error: "#FF3B30",
    success: "#34C759",
  };

  const renderProvider = ({ item }: { item: ProviderSearchResult }) => (
    <TouchableOpacity
      style={[
        styles.providerCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/customer/provider/${item.id}`)}
    >
      <Text style={[styles.providerName, { color: colors.text }]}>
        {item.business_name}
      </Text>
      <Text
        style={[styles.providerBio, { color: colors.textMuted }]}
        numberOfLines={2}
      >
        {item.bio}
      </Text>
      <Text style={[styles.providerAddress, { color: colors.textMuted }]}>
        {item.address}
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
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Find Providers
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.error }]}>
            Logout
          </Text>
        </TouchableOpacity>
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

      <TouchableOpacity
        style={[styles.myBookingsButton, { backgroundColor: colors.success }]}
        onPress={() => router.push("/customer/bookings")}
      >
        <Text style={styles.myBookingsText}>My Bookings</Text>
      </TouchableOpacity>

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
    color: "#151718",
    fontSize: 16,
    fontWeight: "600",
  },
  myBookingsButton: {
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  myBookingsText: {
    color: "#fff",
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
