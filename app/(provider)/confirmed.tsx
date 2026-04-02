import BackButton from "@/components/BackButton";
import BookingActionModal from "@/components/BookingActionModal";
import MessageCustomerButton from "@/components/MessageCustomerButton";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { deleteBooking, getConfirmedBookings } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import { Ionicons } from "@expo/vector-icons";
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

const formatTime = (time: string) => {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr} ${period}`;
};

const groupByDay = (bookings: BookingWithDetails[]) => {
  const grouped: Record<string, BookingWithDetails[]> = {};
  for (const booking of bookings) {
    const day = booking.date.split("T")[0];
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(booking);
  }

  for (const day of Object.keys(grouped)) {
    grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return grouped;
};

const formatDayHeader = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
    setLoading(true);

    try {
      const results = await getConfirmedBookings();
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

  const handleBookingPress = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setModalVisible(true);
  };

  const handleDelete = async (bookingId: string) => {
    setProcessing(bookingId);

    try {
      await deleteBooking(bookingId);
      Alert.alert("Success", "Booking deleted successfully");
      await loadBookings();
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

  const handleBackPress = () => {
    router.push("/manage-bookings");
  };

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: SharedColours.bookingStatus.pending,
    success: SharedColours.success,
  };

  const renderBooking = (item: BookingWithDetails) => (
    <TouchableOpacity
      key={item.booking_id}
      style={[
        styles.bookingCard,
        { backgroundColor: colours.card, borderColor: colours.border },
      ]}
      onPress={() => handleBookingPress(item)}
      disabled={processing === item.booking_id}
    >
      <View style={styles.bookingHeader}>
        <Text style={[styles.serviceName, { color: colours.text }]}>
          {item.service_name}
        </Text>
        <Text style={[styles.price, { color: colours.accent }]}>
          ${item.cost}
        </Text>
      </View>

      <View style={styles.bookingDetails}>
        <Text style={[styles.detailText, { color: colours.textMuted }]}>
          Customer: {item.customer_name}
        </Text>
        <Text style={[styles.detailText, { color: colors.textMuted }]}>
          Time: {formatTime(item.start_time)} – {formatTime(item.end_time)}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: colours.success }]}>
          <Text style={styles.statusText}>Confirmed</Text>
        </View>
        <View style={styles.actionRow}>
          <MessageCustomerButton
            customerId={item.customer_id}
            customerName={item.customer_name}
            size="small"
            showLabel={false}
          />
          <TouchableOpacity
            style={[
              styles.snapshotButton,
              { backgroundColor: colours.card, borderColor: colours.border },
            ]}
            onPress={() => {
              console.log(
                "[Navigation] Navigating to snapshot for customer:",
                item.customer_id,
              );
              router.push(`/snapshot/${item.customer_id}`);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle" size={18} color={colours.accent} />
          </TouchableOpacity>
          {processing === item.booking_id && (
            <ActivityIndicator size="small" color={colours.accent} />
          )}
        </View>
      </View>

      <Text style={[styles.tapHint, { color: colours.textMuted }]}>
        Tap for actions
      </Text>
    </TouchableOpacity>
  );

  const groupedDays = Object.entries(groupByDay(bookings)).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colours.card, borderBottomColor: colours.border },
        ]}
      >
        <BackButton onPress={handleBackPress} />
        <Text style={[styles.title, { color: colours.text }]}>
          Confirmed Bookings
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colours.accent}
          style={styles.loader}
        />
      ) : groupedDays.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No confirmed bookings
        </Text>
      ) : (
        <FlatList
          data={groupedDays}
          keyExtractor={([day]) => day}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item: [day, dayBookings] }) => (
            <View>
              <Text style={[styles.dayHeader, { color: colors.text }]}>
                {formatDayHeader(day)}
              </Text>
              {dayBookings.map(renderBooking)}
            </View>
          )}
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  snapshotButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    minWidth: 36,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: SharedColours.white,
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
