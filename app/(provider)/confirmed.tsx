import BookingActionModal from "@/components/BookingActionModal";
import { useTheme } from "@/context/ThemeContext";
import { deleteBooking, getConfirmedBookings } from "@/services/schedulingApi";
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

export default function ConfirmedBookingsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithDetails | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Refresh bookings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, []),
  );

  const loadBookings = async () => {
    console.log("DEBUG: Loading confirmed bookings...");
    setLoading(true);
    try {
      const results = await getConfirmedBookings();
      console.log("DEBUG: Loaded confirmed bookings:", results);
      setBookings(results);
    } catch (error: any) {
      console.error("DEBUG: Error loading confirmed bookings:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load bookings",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBookingPress = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setModalVisible(true);
  };

  const handleDelete = async (bookingId: string) => {
    setProcessing(bookingId);
    try {
      await deleteBooking(bookingId);
      Alert.alert("Success", "Booking deleted successfully");
      loadBookings();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to delete booking",
      );
    } finally {
      setProcessing(null);
    }
  };

  const handleReschedule = () => {
    loadBookings();
  };

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    success: "#34C759",
  };

  const renderBooking = ({ item }: { item: BookingWithDetails }) => (
    <TouchableOpacity
      style={[
        styles.bookingCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => handleBookingPress(item)}
      disabled={processing === item.booking_id}
    >
      <View style={styles.bookingHeader}>
        <Text style={[styles.serviceName, { color: colors.text }]}>
          {item.service_name}
        </Text>
        <Text style={[styles.price, { color: colors.accent }]}>
          ${item.cost}
        </Text>
      </View>

      <View style={styles.bookingDetails}>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          Customer: {item.customer_name}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          Date: {new Date(item.date).toLocaleDateString()}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          Time: {item.start_time} - {item.end_time}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
          <Text style={styles.statusText}>Confirmed</Text>
        </View>
        {processing === item.booking_id && (
          <ActivityIndicator size="small" color={colors.accent} />
        )}
      </View>

      <Text style={[styles.tapHint, { color: colors.textMuted }]}>
        Tap for actions
      </Text>
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
        <TouchableOpacity onPress={() => router.push("/manage-bookings")}>
          <Text style={[styles.backText, { color: colors.accent }]}>
            {"<"} Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Confirmed Bookings
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
          keyExtractor={(item) => item.booking_id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No confirmed bookings
            </Text>
          }
        />
      )}

      <BookingActionModal
        visible={modalVisible}
        booking={selectedBooking}
        onClose={() => {
          setModalVisible(false);
          setSelectedBooking(null);
        }}
        onDelete={handleDelete}
        onReschedule={handleReschedule}
      />
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
  price: {
    fontSize: 18,
    fontWeight: "bold",
  },
  bookingDetails: {
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  tapHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
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
