import BackButton from "@/components/BackButton";
import { ExtendedColours, SharedColours, UIColours } from "@/constants/theme";
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

export default function SearchProvidersScreen() {
  const { isDarkMode, colours: themeColours } = useTheme();
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

  const handleProviderPress = (provider: ProviderSearchResult) => {
    router.push(
      `provider/${provider.id}?provider=${encodeURIComponent(JSON.stringify(provider))}` as never,
    );
  };

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: themeColours.primary,
    inputBg: extendedColours.inputBg,
    error: SharedColours.error,
  };

  const renderProvider = ({ item }: { item: ProviderSearchResult }) => (
    <TouchableOpacity
      style={[
        styles.providerCard,
        { backgroundColor: colours.card, borderColor: colours.border },
      ]}
      onPress={() => handleProviderPress(item)}
    >
      <Text style={[styles.providerName, { color: colours.text }]}>
        {item.provider_name}
      </Text>
      <Text style={[styles.businessName, { color: colours.textMuted }]}>
        {item.business_name}
      </Text>
      <Text
        style={[styles.providerBio, { color: colours.textMuted }]}
        numberOfLines={2}
      >
        {item.bio}
      </Text>
      <Text style={[styles.providerAddress, { color: colours.textMuted }]}>
        {item.provider_address}
      </Text>
      <View style={styles.servicesContainer}>
        <Text style={[styles.servicesLabel, { color: colours.text }]}>
          Services:
        </Text>
        {item.services.map((service) => (
          <Text
            key={service.id}
            style={[styles.serviceName, { color: colours.textMuted }]}
          >
            • {service.name} - ${service.price}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colours.card,
            borderBottomColor: colours.border,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <BackButton onPress={() => router.back()} style={styles.backButton} />
        <Text style={[styles.title, { color: colours.text }]}>
          Find Providers
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colours.card }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colours.inputBg,
              color: colours.text,
              borderColor: colours.border,
            },
          ]}
          placeholder="Search by name or Provider ID"
          placeholderTextColor={colours.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colours.accent }]}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colours.accent}
          style={styles.loader}
        />
      ) : providers.length > 0 ? (
        <FlatList
          data={providers}
          renderItem={renderProvider}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      ) : searchQuery ? (
        <Text style={[styles.emptyText, { color: colours.textMuted }]}>
          No providers found
        </Text>
      ) : (
        <Text style={[styles.emptyText, { color: colours.textMuted }]}>
          Search for providers by name or Provider ID
        </Text>
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
    padding: 15,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  placeholder: {
    width: 60,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 15,
    borderRadius: 10,
    margin: 15,
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
    color: UIColours.button.textLight,
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    padding: 15,
    paddingTop: 0,
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
