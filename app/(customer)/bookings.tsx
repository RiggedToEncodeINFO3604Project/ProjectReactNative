import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cancelBooking, getMyBookings } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function MyBookingsScreen() {
  const { isDarkMode } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Refresh bookings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, []),
  );

  const loadBookings = async () => {
    console.log("DEBUG: Loading bookings...");
    setLoading(true);
    try {
      const results = await getMyBookings();
      console.log("DEBUG: Loaded bookings:", results);
      setBookings(results);
    } catch (error: any) {
      console.error("DEBUG: Error loading bookings:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load bookings",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelBooking(bookingId);
              Alert.alert("Success", "Booking cancelled successfully");
              loadBookings();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.detail || "Failed to cancel booking",
              );
            }
          },
        },
      ],
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "#34C759";
      case "pending":
        return "#f0c85a";
      case "cancelled":
        return "#FF3B30";
      case "completed":
        return "#007AFF";
      default:
        return "#6b7280";
    }
  };

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
  };

  const renderBooking = ({ item }: { item: BookingWithDetails }) => (
    <View
      style={[
        styles.bookingCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.bookingHeader}>
        <Text style={[styles.serviceName, { color: colors.text }]}>
          {item.service_name}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.providerName, { color: colors.textMuted }]}>
        {item.provider_name}
      </Text>
      <View style={styles.bookingDetails}>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          📅 {new Date(item.date).toLocaleDateString()}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          🕐 {item.start_time} - {item.end_time}
        </Text>
        <Text style={[styles.detailText, { color: colors.accent }]}>
          ${item.cost}
        </Text>
      </View>
      {(item.status === "pending" || item.status === "confirmed") && (
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: "#FF3B30" }]}
          onPress={() => handleCancelBooking(item.booking_id)}
        >
          <Text style={styles.cancelButtonText}>Cancel Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.accent }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>My Bookings</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBooking}
          keyExtractor={(item) => item.booking_id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No bookings found
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
  backText: {
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  listContainer: {
    padding: 15,
  },
  bookingCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  status: {
    fontSize: 12,
    fontWeight: "bold",
  },
  providerName: {
    fontSize: 14,
    marginBottom: 10,
  },
  bookingDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailText: {
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#FF3B30",
    fontWeight: "600",
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
