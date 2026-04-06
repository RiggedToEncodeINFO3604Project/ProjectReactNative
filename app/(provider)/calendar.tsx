import BackButton from "@/components/BackButton";
import {
  ExtendedColours,
  SharedColours,
  getScreenPalette,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { getConfirmedBookings, syncBusyTimes } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import * as Calendar from "expo-calendar";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CalendarList } from "react-native-calendars";

const { width } = Dimensions.get("window");
const CALENDAR_HEIGHT = width * 0.95;

export default function CalendarScreen() {
  const router = useRouter();
  const { isDarkMode, colours: themeColours } = useTheme();
  const colours = getScreenPalette(isDarkMode, {
    backgroundTone: "alt",
    accent: themeColours.primary,
  });
  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [deviceEvents, setDeviceEvents] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<
    Record<string, { marked: boolean; dotColor: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayBookings, setSelectedDayBookings] = useState<
    BookingWithDetails[]
  >([]);
  const [selectedDayDeviceEvents, setSelectedDayDeviceEvents] = useState<any[]>(
    [],
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const calendarTheme = {
    ...SharedColours.calendar,
    textMonthFontWeight: "bold",
  };

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, []),
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadBookings(), loadDeviceEvents()]);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const results = await getConfirmedBookings();
      setBookings(results);
      return results;
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load bookings",
      );
      return [];
    }
  };

  const loadDeviceEvents = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Calendar Permission Required",
          "Calendar permission is needed to sync your personal events and block unavailable times. You can still use the app without it, but customers may book times that conflict with your personal schedule.",
        );
        return [];
      }

      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      const calendarIds = calendars.map((cal) => cal.id);

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      const fetched = await Calendar.getEventsAsync(
        calendarIds,
        startDate,
        endDate,
      );
      setDeviceEvents(fetched);

      // Map events to busy times format and sync to backend
      const busyTimes = fetched.map((event) => {
        // Safely extract date and time components
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);

        // Format date as YYYY-MM-DD
        const date = startDate.toISOString().split("T")[0];

        // Format times as HH:MM
        const start_time = startDate.toTimeString().slice(0, 5);
        const end_time = endDate.toTimeString().slice(0, 5);

        return {
          date,
          start_time,
          end_time,
        };
      });

      // Sync busy times to Firebase (overwrites existing ones)
      try {
        await syncBusyTimes(busyTimes);
        console.log("Busy times synced successfully");
      } catch (syncError) {
        console.error("Failed to sync busy times:", syncError);
        // Don't show alert to user, just log the error
      }

      return fetched;
    } catch (error) {
      console.log("Device calendar error:", error);
      return [];
    }
  };

  const buildMarkedDates = useCallback(() => {
    const marks: Record<string, { marked: boolean; dotColor: string }> = {};
    bookings.forEach((booking) => {
      const dateKey = booking.date.split("T")[0];
      marks[dateKey] = {
        marked: true,
        dotColor: SharedColours.calendar.dotColor,
      };
    });
    deviceEvents.forEach((event) => {
      const dateKey = event.startDate.split("T")[0];
      if (!marks[dateKey]) {
        marks[dateKey] = {
          marked: true,
          dotColor: SharedColours.calendar.dotColor,
        };
      }
    });
    setMarkedDates(marks);
  }, [bookings, deviceEvents]);

  useFocusEffect(
    useCallback(() => {
      buildMarkedDates();
    }, [buildMarkedDates]),
  );

  const renderBooking = ({ item }: { item: BookingWithDetails }) => {
    const dateDisplay = new Date(
      item.date.split("T")[0] + "T12:00:00",
    ).toLocaleDateString();
    return (
      <View
        style={[
          styles.eventItem,
          { backgroundColor: extendedColours.searchInputBg },
        ]}
      >
        <Text style={[styles.eventTitle, { color: colours.text }]}>
          {item.service_name}
        </Text>
        <Text style={[styles.eventDate, { color: colours.textMuted }]}>
          {dateDisplay}
        </Text>
        <Text style={[styles.eventTime, { color: colours.textMuted }]}>
          {item.start_time} – {item.end_time}
        </Text>
        {item.customer_name ? (
          <Text style={[styles.eventCustomer, { color: colours.textSecondary }]}>
            👤 {item.customer_name}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colours.background }]}
    >
      {/* Header with back button */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colours.card,
            borderBottomColor: colours.border,
          },
        ]}
      >
        <BackButton onPress={() => router.back()} />
      </View>

      {/* Modal for day's event details */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: colours.overlay,
            },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colours.card },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colours.text }]}>
              {selectedDateStr}
            </Text>

            {/* Events read from provider's calendar rendered as "Unavailable" */}
            {selectedDayDeviceEvents.length > 0 && (
              <>
                <Text
                  style={[styles.modalSectionLabel, { color: colours.accent }]}
                >
                  Unavailable
                </Text>
                <ScrollView style={{ maxHeight: 150 }}>
                  {selectedDayDeviceEvents.map((e, i) => {
                    const timeOptions = {
                      hour: "2-digit",
                      minute: "2-digit",
                    } as const;
                    const start = new Date(e.startDate).toLocaleTimeString(
                      [],
                      timeOptions,
                    );
                    const end = new Date(e.endDate).toLocaleTimeString(
                      [],
                      timeOptions,
                    );
                    return (
                      <View
                        key={i}
                        style={[
                          styles.eventItem,
                          { backgroundColor: extendedColours.inputBg },
                        ]}
                      >
                        <Text style={[styles.eventTitle, { color: colours.text }]}>
                          Unavailable
                        </Text>
                        <Text
                          style={[styles.eventTime, { color: colours.textMuted }]}
                        >
                          {start} – {end}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Bookings */}
            {selectedDayBookings.length > 0 && (
              <>
                <Text
                  style={[styles.modalSectionLabel, { color: colours.accent }]}
                >
                  Bookings
                </Text>
                <ScrollView style={{ maxHeight: 150 }}>
                  {selectedDayBookings.map((b) => (
                    <View
                      key={b.booking_id}
                      style={[
                        styles.eventItem,
                        { backgroundColor: extendedColours.inputBg },
                      ]}
                    >
                      <Text style={[styles.eventTitle, { color: colours.text }]}>
                        {b.service_name}
                      </Text>
                      <Text
                        style={[styles.eventTime, { color: colours.textMuted }]}
                      >
                        {b.start_time} – {b.end_time}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {selectedDayBookings.length === 0 &&
              selectedDayDeviceEvents.length === 0 && (
                <Text
                  style={[
                    styles.modalEmpty,
                    { color: colours.textMuted },
                  ]}
                >
                  No events or bookings
                </Text>
              )}

            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.closeText, { color: colours.accent }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color={colours.accent} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.booking_id}
          renderItem={renderBooking}
          ListHeaderComponent={
            <View>
              <Text
                style={[
                  styles.title,
                  { color: colours.text },
                  { alignContent: "center", textAlign: "center" },
                ]}
              >
                My Calendar
              </Text>
              <CalendarList
                theme={calendarTheme as any}
                style={styles.calendar}
                calendarStyle={{ paddingHorizontal: 8 }}
                markingType={"dot"}
                markedDates={markedDates}
                calendarHeight={CALENDAR_HEIGHT}
                onDayPress={(day) => {
                  const dayBookings = bookings.filter((b) =>
                    b.date.startsWith(day.dateString),
                  );
                  const dayDeviceEvents = deviceEvents.filter((e) =>
                    e.startDate.startsWith(day.dateString),
                  );
                  setSelectedDayBookings(dayBookings);
                  setSelectedDayDeviceEvents(dayDeviceEvents);
                  setSelectedDateStr(
                    new Date(day.dateString + "T12:00:00").toLocaleDateString(
                      [],
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    ),
                  );
                  setModalVisible(true);
                }}
                pastScrollRange={1}
                futureScrollRange={3}
                scrollEnabled={false}
                showScrollIndicator={false}
              />
            </View>
          }
          ListEmptyComponent={
            <Text
              style={[styles.empty, { color: colours.textMuted }]}
            >
              No upcoming bookings
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  container: { flex: 1 },
  header: {
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    padding: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    padding: 16,
  },
  eventItem: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  eventTitle: { fontSize: 16, fontWeight: "500" },
  eventDate: { fontSize: 13, marginTop: 4 },
  eventTime: { fontSize: 13, marginTop: 2 },
  eventCustomer: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: "center", padding: 20 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  modalSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  modalEmpty: {
    textAlign: "center",
    marginBottom: 12,
  },
  closeText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 16,
  },
});
