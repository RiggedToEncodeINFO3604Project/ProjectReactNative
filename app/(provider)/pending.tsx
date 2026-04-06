import BackButton from "@/components/BackButton";
import ConfirmModal from "@/components/ConfirmModal";
import MessageCustomerButton from "@/components/MessageCustomerButton";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import {
  acceptBooking,
  getConfirmedBookings,
  getPendingBookings,
  rejectBooking,
} from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import * as Calendar from "expo-calendar";
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

//groups bookings first by day, then within each day by start_time slot
const groupByDayThenTime = (bookings: BookingWithDetails[]) => {
  const grouped: Record<string, Record<string, BookingWithDetails[]>> = {};
  for (const booking of bookings) {
    const day = booking.date.split("T")[0];
    if (!grouped[day]) grouped[day] = {};
    const slot = booking.start_time;
    if (!grouped[day][slot]) grouped[day][slot] = [];
    grouped[day][slot].push(booking);
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

export default function PendingBookingsScreen() {
  const { isDarkMode, colours: themeColours } = useTheme();
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [bookingToReject, setBookingToReject] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, []),
  );

  const loadBookings = async () => {
    setLoading(true);
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

  const getWritableCalendar = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") return null;

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    return (
      calendars.find(
        (cal) => cal.allowsModifications && cal.source?.isLocalAccount,
      ) ||
      calendars.find((cal) => cal.allowsModifications) ||
      null
    );
  };

  const parseBookingDateTime = (date: string, time: string): Date => {
    const dateOnly = date.split("T")[0];
    const [hour, minute] = time.split(":").map(Number);
    const d = new Date(`${dateOnly}T00:00:00`);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const addBookingToCalendar = async (
    booking: BookingWithDetails,
    calendarId: string,
  ) => {
    const startDate = parseBookingDateTime(booking.date, booking.start_time);
    const endDate = parseBookingDateTime(booking.date, booking.end_time);

    await Calendar.createEventAsync(calendarId, {
      title: `Booking: ${booking.service_name}`,
      startDate,
      endDate,
      notes: `Customer: ${booking.customer_name}\nPhone: ${booking.customer_phone}`,
      timeZone: "UTC",
    });
  };

  // sync ALL confirmed bookings from Firebase → device calendar

  const syncAllConfirmedToCalendar = async () => {
    setSyncing(true);
    try {
      const writableCalendar = await getWritableCalendar();
      if (!writableCalendar) {
        Alert.alert(
          "Permission Denied",
          "Calendar access is needed to sync bookings.",
        );
        return;
      }

      const confirmed = await getConfirmedBookings();
      if (confirmed.length === 0) {
        Alert.alert("Sync Complete", "No confirmed bookings to sync.");
        return;
      }

      // get existing device calendar events so we don't create duplicates
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1); // look back 1 year
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const existingEvents = await Calendar.getEventsAsync(
        [writableCalendar.id],
        startDate,
        endDate,
      );
      const existingTitles = new Set(existingEvents.map((e) => e.title));

      let added = 0;
      let skipped = 0;

      for (const booking of confirmed) {
        const title = `Booking: ${booking.service_name}`;
        if (existingTitles.has(title)) {
          skipped++;
          continue;
        }
        try {
          await addBookingToCalendar(booking, writableCalendar.id);
          added++;
        } catch (err) {
          console.log(`Failed to add booking ${booking.booking_id}:`, err);
        }
      }

      Alert.alert(
        "Sync Complete",
        `Added ${added} booking(s) to your calendar.${skipped > 0 ? ` Skipped ${skipped} already existing.` : ""}`,
      );
    } catch (error: any) {
      Alert.alert("Sync Error", error.message || "Failed to sync bookings");
    } finally {
      setSyncing(false);
    }
  };

  const handleAccept = async (bookingId: string) => {
    setProcessing(bookingId);
    try {
      const booking = bookings.find((b) => b.booking_id === bookingId);
      await acceptBooking(bookingId);

      if (booking) {
        const writableCalendar = await getWritableCalendar();
        if (writableCalendar) {
          await addBookingToCalendar(booking, writableCalendar.id);
        }
      }

      Alert.alert("Success", "Booking accepted and added to calendar");
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

  const handleReject = (bookingId: string) => {
    setBookingToReject(bookingId);
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!bookingToReject) return;
    setProcessing(bookingToReject);
    setRejectModalVisible(false);
    try {
      await rejectBooking(bookingToReject);
      Alert.alert("Success", "Booking rejected");
      loadBookings();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to reject booking",
      );
    } finally {
      setProcessing(null);
      setBookingToReject(null);
    }
  };

  // ─── Theme ─────────────────────────────────────────────────────────────────

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: themeColours.primary,
    success: SharedColours.success,
    error: SharedColours.error,
    overlap: extendedColours.warningBg,
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
        <Text style={[styles.cost, { color: colours.accent }]}>
          ${item.cost}
        </Text>
      </View>

      <View style={styles.bookingDetails}>
        <Text style={[styles.detailText, { color: colours.textMuted }]}>
          👤 {item.customer_name}
        </Text>
        <Text style={[styles.detailText, { color: colours.textMuted }]}>
          📞 {item.customer_phone}
        </Text>
        <Text style={[styles.detailText, { color: colours.textMuted }]}>
          🕐 {formatTime(item.start_time)} – {formatTime(item.end_time)}
        </Text>
      </View>

      {/* Row 1: Communication tools - Message and Snapshot buttons */}
      <View style={styles.communicationButtons}>
        <MessageCustomerButton
          customerId={item.customer_id}
          customerName={item.customer_name}
          size="medium"
          style={{ flex: 1 }}
        />
        <TouchableOpacity
          style={[styles.snapshotButton, { backgroundColor: colours.accent }]}
          onPress={() => {
            console.log(
              "[Navigation] Navigating to snapshot for customer:",
              item.customer_id,
            );
            router.push(`/snapshot/${item.customer_id}`);
          }}
        >
          <Text
            style={[styles.snapshotButtonText, { color: colours.background }]}
          >
            📊 Snapshot
          </Text>
        </TouchableOpacity>
      </View>

      {/* Row 2: Decision controls - Accept and Reject buttons (separate!) */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colours.success }]}
          onPress={() => handleAccept(item.booking_id)}
          disabled={processing === item.booking_id}
        >
          {processing === item.booking_id ? (
            <ActivityIndicator color={SharedColours.white} size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: colours.error }]}
          onPress={() => handleReject(item.booking_id)}
          disabled={processing === item.booking_id}
        >
          <Text style={[styles.rejectButtonText, { color: colours.error }]}>
            Reject
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const groupedDays = Object.entries(groupByDayThenTime(bookings)).sort(
    ([a], [b]) => a.localeCompare(b),
  );

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colours.card, borderBottomColor: colours.border },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.title, { color: colours.text }]}>
          Pending Bookings
        </Text>
        <TouchableOpacity
          onPress={syncAllConfirmedToCalendar}
          disabled={syncing}
        >
          <Text style={[styles.syncText, { color: colours.accent }]}>
            {syncing ? "Syncing..." : "Sync Cal"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colours.accent}
          style={styles.loader}
        />
      ) : groupedDays.length === 0 ? (
        <Text style={[styles.emptyText, { color: colours.textMuted }]}>
          No pending bookings
        </Text>
      ) : (
        <FlatList
          data={groupedDays}
          keyExtractor={([day]) => day}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item: [day, slots] }) => {
            const sortedSlots = Object.entries(slots).sort(([a], [b]) =>
              a.localeCompare(b),
            );
            return (
              <View>
                <Text style={[styles.dayHeader, { color: colours.text }]}>
                  {formatDayHeader(day)}
                </Text>

                {sortedSlots.map(([slot, slotBookings]) => (
                  <View key={slot}>
                    <View
                      style={[
                        styles.timeSlotHeader,
                        slotBookings.length > 1 && {
                          backgroundColor: colours.overlap,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.timeSlotText, { color: colours.accent }]}
                      >
                        {formatTime(slot)}
                      </Text>
                      {/* overlap badge to warn provider that multiple bookings share this slot */}
                      {slotBookings.length > 1 && (
                        <Text
                          style={[
                            styles.overlapBadge,
                            { color: colours.accent },
                          ]}
                        >
                          {slotBookings.length} overlapping
                        </Text>
                      )}
                    </View>

                    {slotBookings.map(renderBooking)}
                  </View>
                ))}
              </View>
            );
          }}
        />
      )}

      <ConfirmModal
        visible={rejectModalVisible}
        title="Reject Booking"
        message="Are you sure you want to reject this booking? This action cannot be undone."
        confirmText="Reject"
        cancelText="Cancel"
        confirmStyle="danger"
        onConfirm={confirmReject}
        onCancel={() => {
          setRejectModalVisible(false);
          setBookingToReject(null);
        }}
        loading={processing === bookingToReject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  syncText: { fontSize: 14, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "bold" },
  listContainer: { padding: 15 },
  dayHeader: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 8,
  },
  // ─── NEW: time slot row (shown per unique start_time within a day) ─────────
  timeSlotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // ─── NEW: shown next to the time when 2+ bookings share the same slot ──────
  overlapBadge: {
    fontSize: 12,
    fontWeight: "600",
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
  serviceName: { fontSize: 18, fontWeight: "600", flex: 1 },
  cost: { fontSize: 18, fontWeight: "bold" },
  bookingDetails: { marginBottom: 15 },
  detailText: { fontSize: 14, marginBottom: 4 },
  communicationButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  snapshotButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  snapshotButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtons: { flexDirection: "row", gap: 10 },
  acceptButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  acceptButtonText: {
    color: SharedColours.white,
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
  rejectButtonText: { fontSize: 16, fontWeight: "600" },
  loader: { marginTop: 50 },
  emptyText: { textAlign: "center", fontSize: 16, marginTop: 50 },
});
