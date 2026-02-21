import { useTheme } from "@/context/ThemeContext";
import { getAvailability, setAvailability } from "@/services/schedulingApi";
import {
  AvailabilityResponse,
  DayAvailability,
  TimeSlot,
} from "@/types/scheduling";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function ManageAvailabilityScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [schedule, setSchedule] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    dayIndex: number;
    slotIndex: number | null; // null means adding new slot
  } | null>(null);
  const [tempStartTime, setTempStartTime] = useState("09:00");
  const [tempEndTime, setTempEndTime] = useState("17:00");
  const [tempDuration, setTempDuration] = useState(30);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const result = await getAvailability();
      setSchedule(result.schedule || []);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load availability",
      );
    } finally {
      setLoading(false);
    }
  };

  const getDaySchedule = (dayIndex: number): DayAvailability | undefined => {
    return schedule.find((d) => d.day_of_week === dayIndex);
  };

  const addTimeSlot = (dayIndex: number) => {
    // Open modal for adding a new slot (don't add to schedule yet)
    setEditingSlot({ dayIndex, slotIndex: null });
    setTempStartTime("09:00");
    setTempEndTime("17:00");
    setTempDuration(30);
    setEditModalVisible(true);
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const newSchedule = [...schedule];
    const daySchedule = newSchedule.find((d) => d.day_of_week === dayIndex);

    if (daySchedule) {
      daySchedule.time_slots.splice(slotIndex, 1);
      if (daySchedule.time_slots.length === 0) {
        const index = newSchedule.findIndex((d) => d.day_of_week === dayIndex);
        newSchedule.splice(index, 1);
      }
    }

    setSchedule(newSchedule);
  };

  const openEditModal = (
    dayIndex: number,
    slotIndex: number,
    slot: TimeSlot,
  ) => {
    setEditingSlot({ dayIndex, slotIndex }); // slotIndex is a number for existing slots
    setTempStartTime(slot.start_time);
    setTempEndTime(slot.end_time);
    setTempDuration(slot.session_duration || 30);
    setEditModalVisible(true);
  };

  const generateSessionsPreview = (
    startTime: string,
    endTime: string,
    sessionDuration: number,
  ): {
    sessions: { start: string; end: string }[];
    remainderMinutes: number;
    sessionsCreated: number;
  } => {
    const startParts = startTime.split(":").map(Number);
    const endParts = endTime.split(":").map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    const totalMinutes = endMinutes - startMinutes;
    const numSessions = Math.floor(totalMinutes / sessionDuration);
    const remainderMinutes = totalMinutes % sessionDuration;

    const sessions: { start: string; end: string }[] = [];
    let currentTime = startMinutes;

    for (let i = 0; i < numSessions; i++) {
      const sessionStart = currentTime;
      const sessionEnd = currentTime + sessionDuration;

      if (sessionEnd <= endMinutes) {
        sessions.push({
          start: `${Math.floor(sessionStart / 60)
            .toString()
            .padStart(
              2,
              "0",
            )}:${(sessionStart % 60).toString().padStart(2, "0")}`,
          end: `${Math.floor(sessionEnd / 60)
            .toString()
            .padStart(
              2,
              "0",
            )}:${(sessionEnd % 60).toString().padStart(2, "0")}`,
        });
      }

      currentTime = sessionEnd;
    }

    return {
      sessions,
      remainderMinutes,
      sessionsCreated: sessions.length,
    };
  };

  const saveSlotEdit = () => {
    if (!editingSlot) return;

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(tempStartTime) || !timeRegex.test(tempEndTime)) {
      Alert.alert(
        "Invalid Time",
        "Please enter times in HH:MM format (24-hour)",
      );
      return;
    }

    // Validate start < end
    const startParts = tempStartTime.split(":").map(Number);
    const endParts = tempEndTime.split(":").map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    if (startMinutes >= endMinutes) {
      Alert.alert("Invalid Time Range", "Start time must be before end time");
      return;
    }

    const isNewSlot = editingSlot.slotIndex === null;
    const newSchedule = [...schedule];
    const daySchedule = newSchedule.find(
      (d) => d.day_of_week === editingSlot.dayIndex,
    );

    const newSlot: TimeSlot = {
      start_time: tempStartTime,
      end_time: tempEndTime,
      session_duration: tempDuration,
    };

    if (isNewSlot) {
      // Adding a new slot
      if (daySchedule) {
        daySchedule.time_slots.push(newSlot);
      } else {
        newSchedule.push({
          day_of_week: editingSlot.dayIndex,
          time_slots: [newSlot],
        });
      }
    } else {
      // Editing existing slot
      if (
        daySchedule &&
        editingSlot.slotIndex !== null &&
        daySchedule.time_slots[editingSlot.slotIndex]
      ) {
        daySchedule.time_slots[editingSlot.slotIndex] = newSlot;
      }
    }

    setSchedule(newSchedule);
    setEditModalVisible(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result: AvailabilityResponse = await setAvailability({
        providerId: "",
        schedule,
      });

      // Show success modal
      setSuccessModalVisible(true);

      // Auto-dismiss after 2.5 seconds
      const timer = setTimeout(() => {
        setSuccessModalVisible(false);
      }, 2500);

      // Store timer for cleanup if user clicks outside
      return () => clearTimeout(timer);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to save availability",
      );
    } finally {
      setSaving(false);
    }
  };

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
    warning: "#FF9500",
  };

  // Generate live preview for the modal
  const getPreview = () => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(tempStartTime) || !timeRegex.test(tempEndTime)) {
      return null;
    }

    const startParts = tempStartTime.split(":").map(Number);
    const endParts = tempEndTime.split(":").map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    if (startMinutes >= endMinutes) {
      return null;
    }

    return generateSessionsPreview(tempStartTime, tempEndTime, tempDuration);
  };

  const preview = editModalVisible ? getPreview() : null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={styles.loader}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.text }]}>
          Manage Availability
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {DAYS.map((day, dayIndex) => {
          const daySchedule = getDaySchedule(dayIndex);

          return (
            <View
              key={dayIndex}
              style={[
                styles.dayCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.dayTitle, { color: colors.text }]}>
                {day}
              </Text>

              {daySchedule?.time_slots.map((slot, slotIndex) => (
                <TouchableOpacity
                  key={slotIndex}
                  style={[
                    styles.slotRow,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openEditModal(dayIndex, slotIndex, slot)}
                >
                  <View style={styles.slotInfo}>
                    <Text style={[styles.slotTimeText, { color: colors.text }]}>
                      {slot.start_time} - {slot.end_time}
                    </Text>
                    <Text
                      style={[
                        styles.slotDurationText,
                        { color: colors.textMuted },
                      ]}
                    >
                      {slot.session_duration || 30} min sessions
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeButton, { borderColor: colors.error }]}
                    onPress={() => removeTimeSlot(dayIndex, slotIndex)}
                  >
                    <Text
                      style={[styles.removeButtonText, { color: colors.error }]}
                    >
                      {"\u2715"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.addSlotButton, { borderColor: colors.accent }]}
                onPress={() => addTimeSlot(dayIndex)}
              >
                <Text style={[styles.addSlotText, { color: colors.accent }]}>
                  + Add Time Slot
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.accent }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#151718" />
        ) : (
          <Text style={styles.saveButtonText}>Save Availability</Text>
        )}
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingSlot?.slotIndex === null
                ? "Add Time Slot"
                : "Edit Time Slot"}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                Start Time (HH:MM)
              </Text>
              <TextInput
                style={[
                  styles.timeInput,
                  { backgroundColor: colors.inputBg, color: colors.text },
                ]}
                value={tempStartTime}
                onChangeText={setTempStartTime}
                placeholder="09:00"
                placeholderTextColor={colors.textMuted}
                maxLength={5}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                End Time (HH:MM)
              </Text>
              <TextInput
                style={[
                  styles.timeInput,
                  { backgroundColor: colors.inputBg, color: colors.text },
                ]}
                value={tempEndTime}
                onChangeText={setTempEndTime}
                placeholder="17:00"
                placeholderTextColor={colors.textMuted}
                maxLength={5}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                Session Duration (minutes)
              </Text>
              <View style={styles.durationOptions}>
                {DURATION_OPTIONS.map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationButton,
                      {
                        backgroundColor:
                          tempDuration === duration
                            ? colors.accent
                            : colors.inputBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setTempDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        {
                          color:
                            tempDuration === duration ? "#151718" : colors.text,
                        },
                      ]}
                    >
                      {duration}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Live Preview */}
            {preview && (
              <View
                style={[
                  styles.previewContainer,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.previewTitle, { color: colors.text }]}>
                  Sessions Preview
                </Text>
                <Text style={[styles.previewText, { color: colors.textMuted }]}>
                  {preview.sessionsCreated} session
                  {preview.sessionsCreated !== 1 ? "s" : ""} will be created
                </Text>
                {preview.sessions.length > 0 && (
                  <Text
                    style={[styles.previewSessions, { color: colors.text }]}
                  >
                    {preview.sessions
                      .slice(0, 4)
                      .map((s) => `${s.start}-${s.end}`)
                      .join(", ")}
                    {preview.sessions.length > 4 &&
                      ` +${preview.sessions.length - 4} more`}
                  </Text>
                )}
                {preview.remainderMinutes > 0 && (
                  <View style={styles.warningBox}>
                    <Text
                      style={[styles.warningText, { color: colors.warning }]}
                    >
                      ⚠️ {preview.remainderMinutes} minutes will be unused
                    </Text>
                    <Text
                      style={[styles.warningHint, { color: colors.textMuted }]}
                    >
                      Consider adjusting end time or session duration
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={saveSlotEdit}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              Time Slots Saved Successfully
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
  content: {
    padding: 15,
    paddingBottom: 100,
  },
  dayCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  slotInfo: {
    flex: 1,
  },
  slotTimeText: {
    fontSize: 16,
    fontWeight: "500",
  },
  slotDurationText: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
  },
  removeButtonText: {
    fontSize: 14,
  },
  addSlotButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  addSlotText: {
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    position: "absolute",
    bottom: 20,
    left: 15,
    right: 15,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#151718",
    fontSize: 18,
    fontWeight: "600",
  },
  loader: {
    marginTop: 100,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  timeInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    textAlign: "center",
  },
  durationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
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
  previewContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  previewText: {
    fontSize: 13,
    marginBottom: 4,
  },
  previewSessions: {
    fontSize: 12,
    marginTop: 4,
  },
  warningBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
  },
  warningText: {
    fontSize: 13,
    fontWeight: "500",
  },
  warningHint: {
    fontSize: 11,
    marginTop: 2,
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
