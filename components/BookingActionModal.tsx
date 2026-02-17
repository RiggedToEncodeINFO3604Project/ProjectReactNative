import { useTheme } from "@/context/ThemeContext";
import {
  getAvailableSlotsForReschedule,
  rescheduleBooking,
} from "@/services/schedulingApi";
import { AvailableSlot, BookingWithDetails } from "@/types/scheduling";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface BookingActionModalProps {
  visible: boolean;
  booking: BookingWithDetails | null;
  onClose: () => void;
  onDelete: (bookingId: string) => void;
  onReschedule: () => void;
}

export default function BookingActionModal({
  visible,
  booking,
  onClose,
  onDelete,
  onReschedule,
}: BookingActionModalProps) {
  const { isDarkMode } = useTheme();

  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    inputBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
    error: "#FF3B30",
    success: "#34C759",
  };

  const handleDelete = () => {
    if (!booking) return;

    Alert.alert(
      "Delete Booking",
      `Are you sure you want to delete the booking for ${booking.customer_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(booking.booking_id);
            onClose();
          },
        },
      ],
    );
  };

  const handleShowReschedule = () => {
    setShowReschedule(true);
    setSelectedDate("");
    setAvailableSlots([]);
    setSelectedSlot(null);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date && booking) {
      loadAvailableSlots(date);
    }
  };

  const loadAvailableSlots = async (date: string) => {
    if (!booking) return;

    setLoadingSlots(true);
    try {
      const slots = await getAvailableSlotsForReschedule(
        booking.booking_id,
        date,
      );
      setAvailableSlots(slots.filter((slot) => slot.available));
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load available slots",
      );
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!booking || !selectedDate || !selectedSlot) {
      Alert.alert("Error", "Please select a date and time slot");
      return;
    }

    setRescheduling(true);
    try {
      await rescheduleBooking(booking.booking_id, {
        date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      });
      Alert.alert("Success", "Booking rescheduled successfully");
      setShowReschedule(false);
      onReschedule();
      onClose();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to reschedule booking",
      );
    } finally {
      setRescheduling(false);
    }
  };

  const handleClose = () => {
    setShowReschedule(false);
    setSelectedDate("");
    setAvailableSlots([]);
    setSelectedSlot(null);
    onClose();
  };

  if (!booking) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {!showReschedule ? (
            // Main Action View
            <>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Booking Details
              </Text>

              <View style={styles.bookingDetails}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Customer:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {booking.customer_name}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Service:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {booking.service_name}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Date:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {new Date(booking.date).toLocaleDateString()}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Time:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {booking.start_time} - {booking.end_time}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Price:
                </Text>
                <Text style={[styles.detailValue, { color: colors.accent }]}>
                  ${booking.cost}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.error },
                  ]}
                  onPress={handleDelete}
                >
                  <Text style={styles.actionButtonText}>Delete Booking</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.accent },
                  ]}
                  onPress={handleShowReschedule}
                >
                  <Text style={styles.rescheduleButtonText}>
                    Reschedule Booking
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={handleClose}
              >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // Reschedule View
            <>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reschedule Booking
              </Text>

              <Text
                style={[styles.currentBookingText, { color: colors.textMuted }]}
              >
                Current: {booking.service_name} on{" "}
                {new Date(booking.date).toLocaleDateString()} at{" "}
                {booking.start_time}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  New Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={[
                    styles.dateInput,
                    { backgroundColor: colors.inputBg, color: colors.text },
                  ]}
                  value={selectedDate}
                  onChangeText={handleDateChange}
                  placeholder="2024-12-25"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {loadingSlots && (
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={styles.loader}
                />
              )}

              {availableSlots.length > 0 && (
                <View style={styles.slotsContainer}>
                  <Text
                    style={[styles.slotsLabel, { color: colors.textMuted }]}
                  >
                    Available Time Slots:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.slotsScroll}
                  >
                    {availableSlots.map((slot, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.slotButton,
                          {
                            backgroundColor:
                              selectedSlot === slot
                                ? colors.accent
                                : colors.inputBg,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            {
                              color:
                                selectedSlot === slot ? "#151718" : colors.text,
                            },
                          ]}
                        >
                          {slot.start_time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {!loadingSlots && selectedDate && availableSlots.length === 0 && (
                <Text style={[styles.noSlotsText, { color: colors.textMuted }]}>
                  No available slots for this date
                </Text>
              )}

              <View style={styles.rescheduleButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={() => setShowReschedule(false)}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Back
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.accent },
                    { opacity: selectedSlot ? 1 : 0.5 },
                  ]}
                  onPress={handleConfirmReschedule}
                  disabled={!selectedSlot || rescheduling}
                >
                  {rescheduling ? (
                    <ActivityIndicator color="#151718" />
                  ) : (
                    <Text style={styles.modalButtonText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  bookingDetails: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    marginTop: 10,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    gap: 10,
    marginBottom: 15,
  },
  actionButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rescheduleButtonText: {
    color: "#151718",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  // Reschedule styles
  currentBookingText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  dateInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    textAlign: "center",
  },
  loader: {
    marginVertical: 15,
  },
  slotsContainer: {
    marginBottom: 15,
  },
  slotsLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  slotsScroll: {
    flexGrow: 0,
  },
  slotButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  slotText: {
    fontSize: 14,
    fontWeight: "500",
  },
  noSlotsText: {
    textAlign: "center",
    marginVertical: 15,
    fontSize: 14,
  },
  rescheduleButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#151718",
  },
});
