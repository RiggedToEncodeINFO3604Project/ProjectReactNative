import { useTheme } from "@/context/ThemeContext";
import {
    acceptBooking,
    getPendingBookings,
    rejectBooking,
} from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function PendingBookingsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const results = await getPendingBookings();
      setBookings(results);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load bookings",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (bookingId: string) => {
    setProcessing(bookingId);
    try {
      await acceptBooking(bookingId);
      Alert.alert("Success", "Booking accepted");
      loadBookings();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to accept booking",
      );
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    Alert.alert(
      "Reject Booking",
      "Are you sure you want to reject this booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setProcessing(bookingId);
            try {
              await rejectBooking(bookingId);
              Alert.alert("Success", "Booking rejected");
              loadBookings();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.detail || "Failed to reject booking",
              );
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
    );
  };

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    success: "#34C759",
    error: "#FF3B30",
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
          {item.serviceName}
        </Text>
        <Text style={[styles.cost, { color: colors.accent }]}>
          ${item.cost}
        </Text>
      </View>

      <View style={styles.bookingDetails}>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          👤 {item.customerName}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          📞 {item.customerPhone}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          📅 {new Date(item.date).toLocaleDateString()}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          🕐 {item.startTime} - {item.endTime}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.success }]}
          onPress={() => handleAccept(item.bookingId)}
          disabled={processing === item.bookingId}
        >
          {processing === item.bookingId ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: colors.error }]}
          onPress={() => handleReject(item.bookingId)}
          disabled={processing === item.bookingId}
        >
          <Text style={[styles.rejectButtonText, { color: colors.error }]}>
            Reject
          </Text>
        </TouchableOpacity>
      </View>
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
        <Text style={[styles.title, { color: colors.text }]}>
          Pending Bookings
        </Text>
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
          keyExtractor={(item) => item.bookingId}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No pending bookings
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
    marginBottom: 10,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  cost: {
    fontSize: 18,
    fontWeight: "bold",
  },
  bookingDetails: {
    marginBottom: 15,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rejectButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  rejectButtonText: {
    fontSize: 16,
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
