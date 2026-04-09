import ConfirmModal from "@/components/ConfirmModal";
import SuccessModal from "@/components/SuccessModal";
import { useTheme } from "@/context/ThemeContext";
import {
  addDays,
  formatDate,
  getAvailableSlotsForDateRange,
  rescheduleBooking,
} from "@/services/schedulingApi";
import {
  BookingWithDetails,
  DateScheduleData,
  TimeSlot,
} from "@/types/scheduling";
import { formatStoredTime, formatStoredTimeRange } from "@/utils/time";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
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
  const router = useRouter();

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [scheduleData, setScheduleData] = useState<DateScheduleData[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Success modal state
  const [showSuccess, setShowSuccess] = useState(false);

  const colours = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    inputBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
    error: "#FF3B30",
    success: "#34C759",
    available: isDarkMode ? "#1a3a2a" : "#d4edda",
    unavailable: isDarkMode ? "#2a1a1a" : "#f8d7da",
  };

  // Load schedule data when reschedule view is shown
  useEffect(() => {
    if (showReschedule && booking) {
      loadScheduleData();
    }
  }, [showReschedule, booking]);

  const loadScheduleData = async () => {
    if (!booking) return;

    setLoadingSchedule(true);
    setScheduleError(null);
    setExpandedDate(null);
    setSelectedSlot(null);
    setSelectedDate(null);

    try {
      const today = new Date();
      const startDate = formatDate(today);
      const endDate = formatDate(addDays(today, 13)); // Next 14 days

      const data = await getAvailableSlotsForDateRange(
        booking.booking_id,
        startDate,
        endDate,
      );

      setScheduleData(data);
    } catch (error: any) {
      console.error("Failed to load schedule data:", error);
      setScheduleError(
        error.response?.data?.detail || "Failed to load available dates",
      );
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleDelete = () => {
    if (!booking) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!booking) return;

    setDeleting(true);

    try {
      await onDelete(booking.booking_id);
      setShowDeleteConfirm(false);
      setShowSuccess(true);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      setShowDeleteConfirm(false);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to cancel booking",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleShowReschedule = () => {
    setShowReschedule(true);
  };

  const handleDateExpand = (date: string) => {
    if (expandedDate === date) {
      setExpandedDate(null);
    } else {
      setExpandedDate(date);
      setSelectedSlot(null);
      setSelectedDate(null);
    }
  };

  const handleSlotSelect = (date: string, slot: TimeSlot) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
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
    setScheduleData([]);
    setExpandedDate(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setScheduleError(null);
    onClose();
  };

  const handleViewCustomerSnapshot = () => {
    if (booking?.customer_id) {
      handleClose();
      router.push({
        pathname: "/(provider)/snapshot/[customerId]",
        params: { customerId: booking.customer_id },
      } as any);
    } else {
      Alert.alert("Error", "Customer ID not available");
    }
  };

  const handleBack = () => {
    setShowReschedule(false);
    setScheduleData([]);
    setExpandedDate(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setScheduleError(null);
  };

  const renderDateItem = ({ item }: { item: DateScheduleData }) => {
    const isExpanded = expandedDate === item.date;
    const isSelected = selectedDate === item.date;

    return (
      <View style={styles.dateItemContainer}>
        <TouchableOpacity
          style={[
            styles.dateItem,
            {
              backgroundColor: isSelected
                ? colours.accent + "20"
                : colours.inputBg,
              borderColor: isSelected ? colours.accent : colours.border,
            },
          ]}
          onPress={() => handleDateExpand(item.date)}
          disabled={!item.hasAvailability}
          activeOpacity={0.7}
        >
          <View style={styles.dateItemLeft}>
            <Text
              style={[
                styles.dateText,
                {
                  color: item.hasAvailability
                    ? colours.text
                    : colours.textMuted,
                },
              ]}
            >
              {item.displayDate}
              {item.isToday && " (Today)"}
              {item.isTomorrow && " (Tomorrow)"}
            </Text>
            <Text style={[styles.dayText, { color: colours.textMuted }]}>
              {item.dayOfWeek}
            </Text>
          </View>
          <View style={styles.dateItemRight}>
            {item.hasAvailability ? (
              <>
                <Text style={[styles.slotCount, { color: colours.success }]}>
                  {item.availableCount} slots
                </Text>
                <Text style={[styles.expandIcon, { color: colours.textMuted }]}>
                  {isExpanded ? "v" : ">"}
                </Text>
              </>
            ) : (
              <Text style={[styles.noSlots, { color: colours.textMuted }]}>
                No slots
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && item.hasAvailability && (
          <View
            style={[
              styles.slotsContainer,
              { backgroundColor: colours.inputBg, borderColor: colours.border },
            ]}
          >
            <Text style={[styles.slotsLabel, { color: colours.textMuted }]}>
              Available Times:
            </Text>
            <View style={styles.slotsGrid}>
              {item.availableSlots.map((slot, index) => {
                const isSlotSelected =
                  selectedDate === item.date &&
                  selectedSlot?.start_time === slot.start_time;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.slotButton,
                      {
                        backgroundColor: isSlotSelected
                          ? colours.accent
                          : colours.card,
                        borderColor: isSlotSelected
                          ? colours.accent
                          : colours.border,
                      },
                    ]}
                    onPress={() => handleSlotSelect(item.date, slot)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        {
                          color: isSlotSelected ? "#151718" : colours.text,
                        },
                      ]}
                    >
                      {formatStoredTime(slot.start_time)}
                    </Text>
                    <Text
                      style={[
                        styles.slotDuration,
                        {
                          color: isSlotSelected ? "#151718" : colours.textMuted,
                        },
                      ]}
                    >
                      {slot.session_duration}min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loadingSchedule) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>X</Text>
        <Text style={[styles.emptyTitle, { color: colours.text }]}>
          No Available Slots
        </Text>
        <Text style={[styles.emptyMessage, { color: colours.textMuted }]}>
          No available slots found for the next 14 days.
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colours.accent }]}
          onPress={loadScheduleData}
        >
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={[styles.errorTitle, { color: colours.error }]}>
        Failed to Load
      </Text>
      <Text style={[styles.errorMessage, { color: colours.textMuted }]}>
        {scheduleError}
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: colours.accent }]}
        onPress={loadScheduleData}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!booking) {
    return null;
  }

  return (
    <>
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
              showReschedule && styles.rescheduleModalContent,
              { backgroundColor: colours.card, borderColor: colours.border },
            ]}
          >
            {!showReschedule ? (
              // Main Action View
              <>
                <Text style={[styles.modalTitle, { color: colours.text }]}>
                  Booking Details
                </Text>

                <View style={styles.bookingDetails}>
                  <Text
                    style={[styles.detailLabel, { color: colours.textMuted }]}
                  >
                    Customer:
                  </Text>
                  <Text style={[styles.detailValue, { color: colours.text }]}>
                    {booking.customer_name}
                  </Text>

                  <Text
                    style={[styles.detailLabel, { color: colours.textMuted }]}
                  >
                    Service:
                  </Text>
                  <Text style={[styles.detailValue, { color: colours.text }]}>
                    {booking.service_name}
                  </Text>

                  <Text
                    style={[styles.detailLabel, { color: colours.textMuted }]}
                  >
                    Date:
                  </Text>
                  <Text style={[styles.detailValue, { color: colours.text }]}>
                    {new Date(booking.date).toLocaleDateString()}
                  </Text>

                  <Text
                    style={[styles.detailLabel, { color: colours.textMuted }]}
                  >
                    Time:
                  </Text>
                  <Text style={[styles.detailValue, { color: colours.text }]}>
                    {formatStoredTimeRange(
                      booking.start_time,
                      booking.end_time,
                    )}
                  </Text>

                  <Text
                    style={[styles.detailLabel, { color: colours.textMuted }]}
                  >
                    Price:
                  </Text>
                  <Text style={[styles.detailValue, { color: colours.accent }]}>
                    ${booking.cost}
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: colours.error },
                    ]}
                    onPress={handleDelete}
                  >
                    <Text style={styles.actionButtonText}>Cancel Booking</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: colours.accent },
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
                    { backgroundColor: colours.inputBg },
                  ]}
                  onPress={handleClose}
                >
                  <Text
                    style={[styles.closeButtonText, { color: colours.text }]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              // Reschedule View - Static Date List
              <>
                <View style={styles.rescheduleContent}>
                  <Text style={[styles.modalTitle, { color: colours.text }]}>
                    Reschedule Booking
                  </Text>

                  <Text
                    style={[
                      styles.currentBookingText,
                      { color: colours.textMuted },
                    ]}
                  >
                    Current: {booking.service_name} on{" "}
                    {new Date(booking.date).toLocaleDateString()} at{" "}
                    {formatStoredTime(booking.start_time)}
                  </Text>

                  <Text
                    style={[styles.selectPrompt, { color: colours.textMuted }]}
                  >
                    Select a New Date & Time
                  </Text>

                  {loadingSchedule ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={colours.accent} />
                      <Text
                        style={[
                          styles.loadingText,
                          { color: colours.textMuted },
                        ]}
                      >
                        Loading available dates...
                      </Text>
                    </View>
                  ) : scheduleError ? (
                    renderErrorState()
                  ) : (
                    <FlatList
                      data={scheduleData}
                      renderItem={renderDateItem}
                      keyExtractor={(item) => item.date}
                      style={styles.dateList}
                      contentContainerStyle={styles.dateListContent}
                      ListEmptyComponent={renderEmptyState}
                      showsVerticalScrollIndicator={false}
                    />
                  )}

                  {/* Selected slot summary */}
                  {selectedSlot && selectedDate && (
                    <View
                      style={[
                        styles.selectedSummary,
                        { backgroundColor: colours.accent + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.summaryText, { color: colours.text }]}
                      >
                        Selected: {selectedDate} at{" "}
                        {formatStoredTime(selectedSlot.start_time)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.rescheduleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { backgroundColor: colours.inputBg },
                    ]}
                    onPress={handleBack}
                  >
                    <Text
                      style={[styles.modalButtonText, { color: colours.text }]}
                    >
                      Back
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { backgroundColor: colours.accent },
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Cancel Booking"
        message={`Are you sure you want to cancel the booking for ${booking?.customer_name || "this customer"}? This action cannot be undone.`}
        confirmText="Yes, Cancel"
        cancelText="No, Keep It"
        confirmStyle="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccess}
        message="Booking Cancelled Successfully"
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    maxHeight: "85%",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  rescheduleModalContent: {
    width: "92%",
    maxWidth: 520,
    height: "80%",
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
    marginBottom: 10,
  },
  rescheduleContent: {
    flex: 1,
    minHeight: 0,
  },
  selectPrompt: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "500",
  },
  // Date list styles
  dateList: {
    flex: 1,
    minHeight: 0,
  },
  dateListContent: {
    paddingBottom: 10,
    flexGrow: 1,
  },
  dateItemContainer: {
    marginBottom: 8,
  },
  dateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateItemLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dayText: {
    fontSize: 12,
    marginTop: 2,
  },
  dateItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slotCount: {
    fontSize: 14,
    fontWeight: "500",
  },
  expandIcon: {
    fontSize: 14,
    fontWeight: "bold",
  },
  noSlots: {
    fontSize: 14,
  },
  // Slots container
  slotsContainer: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  slotsLabel: {
    fontSize: 12,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 70,
  },
  slotText: {
    fontSize: 14,
    fontWeight: "600",
  },
  slotDuration: {
    fontSize: 10,
    marginTop: 2,
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: "#9BA1A6",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  // Error state
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: "#FF3B30",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  // Retry button
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#151718",
    fontSize: 16,
    fontWeight: "600",
  },
  // Selected summary
  selectedSummary: {
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  // Bottom buttons
  rescheduleButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingTop: 4,
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
