import BackButton from "@/components/BackButton";
import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import { ExtendedColors, SharedColors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cancelBooking, getMyBookings } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
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

export default function MyBookingsScreen() {
  const { isDarkMode, colors: themeColors } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();

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
        return SharedColors.bookingStatus.confirmed;
      case "pending":
        return SharedColors.bookingStatus.pending;
      case "cancelled":
        return SharedColors.bookingStatus.cancelled;
      case "completed":
        return SharedColors.bookingStatus.completed;
      default:
        return SharedColors.bookingStatus.default;
    }
  };

  const extendedColors = ExtendedColors[isDarkMode ? "dark" : "light"];

  const colors = {
    background: extendedColors.background,
    card: extendedColors.card,
    text: extendedColors.text,
    textMuted: extendedColors.textMuted,
    border: extendedColors.border,
    accent: themeColors.accent,
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
          style={[styles.cancelButton, { borderColor: SharedColors.error }]}
          onPress={() => handleCancelBooking(item.booking_id)}
          disabled={processing === item.booking_id}
        >
          {processing === item.booking_id ? (
            <ActivityIndicator color={SharedColors.error} />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
          )}
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
        <BackButton onPress={() => router.back()} />
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
    color: SharedColors.error,
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
