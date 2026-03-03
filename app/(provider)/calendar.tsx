import { useTheme } from "@/context/ThemeContext";
import { getConfirmedBookings } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CalendarList } from "react-native-calendars";

export default function CalendarScreen() {
  const { isDarkMode } = useTheme();
  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
  };

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [markedDates, setMarkedDates] = useState<
    Record<string, { marked: boolean; dotColor: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayBookings, setSelectedDayBookings] = useState<
    BookingWithDetails[]
  >([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const calendarTheme = {
    backgroundColor: "#f5d06e",
    calendarBackground: "#f5d06e",
    textSectionTitleColor: "#000",
    dayTextColor: "#000",
    todayTextColor: "#8B0000",
    selectedDayBackgroundColor: "#6366F1",
    selectedDayTextColor: "#fff",
    arrowColor: "#000",
    monthTextColor: "#000",
    textMonthFontWeight: "bold",
    textDisabledColor: "#888",
  };

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

      const marks: Record<string, { marked: boolean; dotColor: string }> = {};
      results.forEach((booking) => {
        const dateKey = booking.date.split("T")[0];
        marks[dateKey] = { marked: true, dotColor: "#8B0000" };
      });
      setMarkedDates(marks);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load calendar",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderBooking = ({ item }: { item: BookingWithDetails }) => {
    const dateDisplay = new Date(item.date).toLocaleDateString();
    return (
      <View
        style={[
          styles.eventItem,
          { backgroundColor: isDarkMode ? "#333" : "#f0f0f0" },
        ]}
      >
        <Text
          style={[styles.eventTitle, { color: isDarkMode ? "#fff" : "#000" }]}
        >
          {item.service_name}
        </Text>
        <Text
          style={[styles.eventDate, { color: isDarkMode ? "#ccc" : "#666" }]}
        >
          {dateDisplay}
        </Text>
        <Text
          style={[styles.eventTime, { color: isDarkMode ? "#ccc" : "#888" }]}
        >
          {item.start_time} – {item.end_time}
        </Text>
        {item.customer_name ? (
          <Text
            style={[
              styles.eventCustomer,
              { color: isDarkMode ? "#ccc" : "#555" },
            ]}
          >
            👤 {item.customer_name}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#151718" : "#f5f5f5" },
      ]}
    >
      {/* Modal for day details */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: isDarkMode
                ? "rgba(0,0,0,0.7)"
                : "rgba(0,0,0,0.3)",
            },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDarkMode ? "#1e2333" : "#fff" },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: isDarkMode ? "#fff" : "#000" },
              ]}
            >
              Bookings on {selectedDateStr}
            </Text>
            {selectedDayBookings.length === 0 ? (
              <Text
                style={[
                  styles.modalEmpty,
                  { color: isDarkMode ? "#9BA1A6" : "#6b7280" },
                ]}
              >
                No bookings
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 200 }}>
                {selectedDayBookings.map((b) => (
                  <View key={b.booking_id} style={styles.eventItem}>
                    <Text
                      style={[
                        styles.eventTitle,
                        { color: isDarkMode ? "#fff" : "#000" },
                      ]}
                    >
                      {b.service_name}
                    </Text>
                    <Text style={[styles.eventTime, { color: "#fff" }]}>
                      {b.start_time} – {b.end_time}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.closeText, { color: colors.accent }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#50cebb"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.booking_id}
          renderItem={renderBooking}
          ListHeaderComponent={
            <View>
              <Text
                style={[styles.title, { color: isDarkMode ? "#fff" : "#000" }]}
              >
                My Calendar
              </Text>
              <CalendarList
                theme={calendarTheme as any}
                style={styles.calendar}
                markingType={"dot"}
                markedDates={markedDates}
                onDayPress={(day) => {
                  const dayBookings = bookings.filter((b) =>
                    b.date.startsWith(day.dateString),
                  );
                  setSelectedDayBookings(dayBookings);
                  setSelectedDateStr(day.dateString);
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
              style={[styles.empty, { color: isDarkMode ? "#9BA1A6" : "#999" }]}
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
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  container: { flex: 1 },
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
