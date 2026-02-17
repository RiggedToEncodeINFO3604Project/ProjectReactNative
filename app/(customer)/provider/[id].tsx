import { useTheme } from "@/context/ThemeContext";
import {
  createBooking,
  getProviderAvailability,
  getProviderCalendar,
} from "@/services/schedulingApi";
import {
  DayBookingStatus,
  ProviderSearchResult,
  Service,
  TimeSlot,
} from "@/types/scheduling";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Days of week for display (Sunday first)
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Helper function to parse date string (YYYY-MM-DD) without timezone issues
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Get day of week (0 = Sunday, 1 = Monday, etc.)
const getDayOfWeek = (dateStr: string): number => {
  return parseDateString(dateStr).getDay();
};

// Get day of month (1-31)
const getDayOfMonth = (dateStr: string): number => {
  return parseDateString(dateStr).getDate();
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ProviderDetailsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { id, provider: providerJson } = useLocalSearchParams<{
    id: string;
    provider: string;
  }>();

  const provider: ProviderSearchResult = providerJson
    ? JSON.parse(providerJson)
    : null;

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [calendarData, setCalendarData] = useState<DayBookingStatus[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  // Initialize to first day of current month to avoid date overflow issues
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (id) {
      loadCalendar();
    }
  }, [id, currentMonth]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      loadAvailability();
    }
  }, [selectedDate, selectedService]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const data = await getProviderCalendar(
        id,
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
      );
      setCalendarData(data);
    } catch (error: any) {
      Alert.alert("Error", "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    try {
      const data = await getProviderAvailability(id, selectedDate!);
      setAvailableSlots(data.available_slots);
    } catch (error: any) {
      Alert.alert("Error", "Failed to load availability");
    }
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) {
      Alert.alert("Error", "Please select a service, date, and time slot");
      return;
    }

    setLoading(true);
    try {
      await createBooking({
        providerId: id,
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
      });

      // Show success modal
      setSuccessModalVisible(true);

      // Auto-dismiss after 2.5 seconds and navigate back
      setTimeout(() => {
        setSuccessModalVisible(false);
        router.back();
      }, 2500);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Failed to create booking";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getDayColor = (status: string) => {
    switch (status) {
      case "fully_booked":
        return "#FF3B30"; // Red
      case "mostly_booked":
        return "#f0c85a"; // Yellow
      case "partially_booked":
      case "available":
        return "#34C759"; // Green
      default:
        return "#6b7280"; // Gray
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

  if (!provider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          Provider not found
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.accent }]}>
              {"<"} Back
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.providerInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.providerName, { color: colors.text }]}>
            {provider.provider_name}
          </Text>
          <Text style={[styles.businessName, { color: colors.textMuted }]}>
            {provider.business_name}
          </Text>
          <Text style={[styles.bio, { color: colors.textMuted }]}>
            {provider.bio}
          </Text>
          <Text style={[styles.address, { color: colors.textMuted }]}>
            {provider.provider_address}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Select Service
          </Text>
          {provider.services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[
                styles.serviceItem,
                {
                  backgroundColor:
                    selectedService?.id === service.id
                      ? colors.accent
                      : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setSelectedService(service)}
            >
              <Text
                style={[
                  styles.serviceName,
                  {
                    color:
                      selectedService?.id === service.id
                        ? "#151718"
                        : colors.text,
                  },
                ]}
              >
                {service.name}
              </Text>
              <Text
                style={[
                  styles.servicePrice,
                  {
                    color:
                      selectedService?.id === service.id
                        ? "#151718"
                        : colors.accent,
                  },
                ]}
              >
                ${service.price}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedService && (
          <View style={styles.section}>
            <View style={styles.monthHeader}>
              <TouchableOpacity
                onPress={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                    ),
                  )
                }
              >
                <Text style={[styles.monthNav, { color: colors.accent }]}>
                  &#8592;
                </Text>
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                    ),
                  )
                }
              >
                <Text style={[styles.monthNav, { color: colors.accent }]}>
                  &#8594;
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {DAYS_OF_WEEK.map((day) => (
                <View key={day} style={styles.dayHeader}>
                  <Text
                    style={[styles.dayHeaderText, { color: colors.textMuted }]}
                  >
                    {day}
                  </Text>
                </View>
              ))}
              {/* Empty cells for days before the 1st of the month */}
              {calendarData.length > 0 &&
                Array.from({
                  length: getDayOfWeek(calendarData[0].date),
                }).map((_, index) => (
                  <View key={`empty-${index}`} style={styles.emptyDayCell} />
                ))}
              {calendarData.map((day, index) => (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor:
                        selectedDate === day.date
                          ? colors.accent
                          : getDayColor(day.status),
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    day.status !== "unavailable" && setSelectedDate(day.date)
                  }
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: selectedDate === day.date ? "#151718" : "#fff",
                      },
                    ]}
                  >
                    {getDayOfMonth(day.date)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {selectedDate && availableSlots.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Available Time Slots
            </Text>
            <View style={styles.slotsContainer}>
              {availableSlots.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.slotButton,
                    {
                      backgroundColor:
                        selectedSlot === slot ? colors.accent : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text
                    style={[
                      styles.slotText,
                      {
                        color: selectedSlot === slot ? "#151718" : colors.text,
                      },
                    ]}
                  >
                    {slot.start_time} - {slot.end_time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {selectedSlot && (
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.accent }]}
            onPress={handleBooking}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#151718" />
            ) : (
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.successModalOverlay}
          activeOpacity={1}
          onPress={() => setSuccessModalVisible(false)}
        >
          <View
            style={[
              styles.successModalContent,
              { backgroundColor: colors.card },
            ]}
          >
            <View style={styles.successCircle}>
              <Text style={styles.successCheckmark}>✓</Text>
            </View>
            <Text style={[styles.successMessage, { color: colors.text }]}>
              Booking Request Sent Successfully
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
  },
  backText: {
    fontSize: 16,
  },
  providerInfo: {
    padding: 20,
  },
  providerName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  businessName: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  serviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  serviceName: {
    fontSize: 16,
    flex: 1,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "600",
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  monthNav: {
    fontSize: 24,
    fontWeight: "bold",
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayHeader: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyDayCell: {
    width: "14.28%",
    aspectRatio: 1,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
  },
  slotsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  slotText: {
    fontSize: 14,
  },
  bookButton: {
    margin: 15,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  bookButtonText: {
    color: "#151718",
    fontSize: 18,
    fontWeight: "600",
  },
  errorText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
  },
  successModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  successModalContent: {
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successCheckmark: {
    fontSize: 40,
    color: "#ffffff",
    fontWeight: "bold",
  },
  successMessage: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
