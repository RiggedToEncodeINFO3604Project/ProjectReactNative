import BackButton from "@/components/BackButton";
import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { cancelBooking, getMyBookings } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import { formatStoredTimeRange } from "@/utils/time";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// groups a flat bookings array the sorts chronologically by day
const groupByDay = (bookings: BookingWithDetails[]) => {
  const grouped: Record<string, BookingWithDetails[]> = {};
  for (const booking of bookings) {
    const day = booking.date.split("T")[0];
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(booking);
  }
  // Sort each day's bookings by start_time
  for (const day of Object.keys(grouped)) {
    grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return grouped;
};

// formats the date into a more readable day header
const formatDayHeader = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// ──────────────────────────────────────────────────────────────────────────

export default function MyBookingsScreen() {
  const { isDarkMode, colours: themeColours } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Confirmation modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Success modal state
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Error modal state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Refresh bookings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, []),
  );

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const results = await getMyBookings();
      setBookings(results);
    } catch (error: any) {
      console.error("[CustomerBookings]", "Error loading bookings:", error);
      showError(error.response?.data?.detail || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    // Show the styled confirmation modal
    setBookingToCancel(bookingId);
    setModalVisible(true);
  };

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;

    setCancelling(true);
    setProcessing(bookingToCancel);

    try {
      await cancelBooking(bookingToCancel);

      // Close the confirmation modal
      setModalVisible(false);
      setBookingToCancel(null);

      // Show success modal with green checkmark
      setSuccessModalVisible(true);

      // Refresh the bookings list
      await loadBookings();
    } catch (error: any) {
      console.error("[CustomerBookings]", "Error during cancellation:", error);

      // Close the confirmation modal
      setModalVisible(false);
      setBookingToCancel(null);

      showError(error.response?.data?.detail || "Failed to cancel booking");
    } finally {
      setCancelling(false);
      setProcessing(null);
    }
  };

  const cancelCancelBooking = () => {
    setModalVisible(false);
    setBookingToCancel(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return SharedColours.bookingStatus.confirmed;
      case "pending":
        return SharedColours.bookingStatus.pending;
      case "cancelled":
        return SharedColours.bookingStatus.cancelled;
      case "completed":
        return SharedColours.bookingStatus.completed;
      default:
        return SharedColours.bookingStatus.default;
    }
  };

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: themeColours.accent,
  };

  const renderBooking = (item: BookingWithDetails) => (
    <View
      key={item.booking_id}
      style={[
        styles.bookingCard,
        { backgroundColor: colours.card, borderColor: colours.border },
      ]}
    >
      <View style={styles.bookingHeader}>
        <Text style={[styles.serviceName, { color: colours.text }]}>
          {item.service_name}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.providerName, { color: colours.textMuted }]}>
        {item.provider_name}
      </Text>
      <View style={styles.bookingDetails}>
        <Text style={[styles.detailText, { color: colours.textMuted }]}>
          {/* time displayed in 12hr format */}
          🕐 {formatStoredTimeRange(item.start_time, item.end_time)}
        </Text>
        <Text style={[styles.detailText, { color: colours.accent }]}>
          ${item.cost}
        </Text>
      </View>
      {(item.status === "pending" || item.status === "confirmed") && (
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: SharedColours.error }]}
          onPress={() => handleCancelBooking(item.booking_id)}
          disabled={processing === item.booking_id}
        >
          {processing === item.booking_id ? (
            <ActivityIndicator color={SharedColours.error} />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // building and sorting the list then rendering each day
  const groupedDays = Object.entries(groupByDay(bookings)).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colours.card,
            borderBottomColor: colours.border,
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
          },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.title, { color: colours.text }]}>My Bookings</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colours.accent}
          style={styles.loader}
        />
      ) : groupedDays.length === 0 ? (
        <Text style={[styles.emptyText, { color: colours.textMuted }]}>
          No bookings found
        </Text>
      ) : (
        // rendering each booking
        <FlatList
          data={groupedDays}
          keyExtractor={([day]) => day}
          contentContainerStyle={[
            styles.listContainer,
            {
              paddingLeft: 15 + insets.left,
              paddingRight: 15 + insets.right,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
          renderItem={({ item: [day, dayBookings] }) => (
            <View>
              {/* Day header */}
              <Text style={[styles.dayHeader, { color: colours.text }]}>
                {formatDayHeader(day)}
              </Text>
              {dayBookings.map(renderBooking)}
            </View>
          )}
        />
      )}

      {/* Styled Confirmation Modal */}
      <ConfirmModal
        visible={modalVisible}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Yes, Cancel"
        cancelText="No, Keep It"
        confirmStyle="danger"
        onConfirm={confirmCancelBooking}
        onCancel={cancelCancelBooking}
        loading={cancelling}
      />

      {/* Success Modal with green checkmark */}
      <SuccessModal
        visible={successModalVisible}
        message="Booking Cancelled Successfully"
        onClose={() => setSuccessModalVisible(false)}
      />

      {/* Error Modal */}
      <ConfirmModal
        visible={errorModalVisible}
        title="Error"
        message={errorMessage}
        confirmText="OK"
        confirmStyle="primary"
        onConfirm={() => setErrorModalVisible(false)}
        onCancel={() => setErrorModalVisible(false)}
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
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  listContainer: {
    padding: 15,
  },
  dayHeader: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 8,
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
    color: SharedColours.error,
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
