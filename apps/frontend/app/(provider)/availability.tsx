import BackButton from "@/components/BackButton";
import { ExtendedColours, SharedColours, UIColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import {
  getAvailability,
  getMyServices,
  setAvailability,
} from "@/services/schedulingApi";
import {
  AvailabilityRecurrence,
  DayAvailability,
  Service,
  TimeSlot,
} from "@/types/scheduling";
import {
  formatStoredTime,
  formatStoredTimeRange,
  parseTwelveHourTime,
} from "@/utils/time";
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
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNextOccurrenceForDay = (today: Date, dayIndex: number) => {
  const todayDayIndex = (today.getDay() + 6) % 7;
  const occurrence = new Date(today);
  occurrence.setHours(0, 0, 0, 0);

  let daysAhead = dayIndex - todayDayIndex;
  if (daysAhead < 0) {
    daysAhead += 7;
  }

  occurrence.setDate(today.getDate() + daysAhead);
  return occurrence;
};

export default function ManageAvailabilityScreen() {
  const { isDarkMode, colours: themeColours } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date();
  const todayString = formatDate(today);

  const [schedule, setSchedule] = useState<DayAvailability[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    dayIndex: number;
    slotIndex: number | null; // null means adding new slot
  } | null>(null);
  const [tempStartTime, setTempStartTime] = useState(formatStoredTime("09:00"));
  const [tempEndTime, setTempEndTime] = useState(formatStoredTime("17:00"));
  const [tempDuration, setTempDuration] = useState(30);
  const [tempRecurrence, setTempRecurrence] =
    useState<AvailabilityRecurrence>("repeat_weekly");
  const [tempEndDate, setTempEndDate] = useState(todayString);
  const [tempSelectedServiceIds, setTempSelectedServiceIds] = useState<
    string[]
  >([]);

  const getOneTimeOptionLabel = () => {
    if (!editingSlot) {
      return "Just Today";
    }

    const todayDayIndex = (today.getDay() + 6) % 7;
    if (editingSlot.dayIndex === todayDayIndex) {
      return "Just Today";
    }

    return `Just the next ${DAYS[editingSlot.dayIndex]}`;
  };

  const recurrenceOptions = [
    { value: "repeat_weekly" as const, label: "Repeat Weekly" },
    {
      value: "just_today" as const,
      label: getOneTimeOptionLabel(),
    },
    { value: "just_this_month" as const, label: "Just This Month" },
    { value: "specified_end_date" as const, label: "Specified End Date" },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [availabilityResult, servicesResult] = await Promise.all([
        getAvailability(),
        getMyServices(),
      ]);
      const normalizedServices = servicesResult || [];
      const normalizedSchedule = (availabilityResult.schedule || []).map(
        (day) => ({
          ...day,
          time_slots: day.time_slots.map((slot) => ({
            ...slot,
            service_ids:
              slot.service_ids && slot.service_ids.length > 0
                ? slot.service_ids
                : normalizedServices.length === 1
                  ? [normalizedServices[0].id]
                  : [],
          })),
        }),
      );

      setServices(normalizedServices);
      setSchedule(normalizedSchedule);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load availability data",
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
    setTempStartTime(formatStoredTime("09:00"));
    setTempEndTime(formatStoredTime("17:00"));
    setTempDuration(30);
    setTempRecurrence("repeat_weekly");
    setTempEndDate(todayString);
    setTempSelectedServiceIds(
      services.length === 1 ? [services[0].id] : [],
    );
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
    const slotRecurrence = String(slot.recurrence_type || "repeat_weekly");
    setEditingSlot({ dayIndex, slotIndex }); // slotIndex is a number for existing slots
    setTempStartTime(formatStoredTime(slot.start_time));
    setTempEndTime(formatStoredTime(slot.end_time));
    setTempDuration(slot.session_duration || 30);
    setTempRecurrence(
      slotRecurrence === "just_this_week"
        ? "just_today"
        : ((slot.recurrence_type ?? "repeat_weekly") as AvailabilityRecurrence),
    );
    setTempEndDate(slot.end_date || todayString);
    setTempSelectedServiceIds(
      slot.service_ids && slot.service_ids.length > 0
        ? slot.service_ids
        : services.length === 1
          ? [services[0].id]
          : [],
    );
    setEditModalVisible(true);
  };

  const getEffectiveStartDate = (existingSlot?: TimeSlot) => {
    if (
      existingSlot &&
      existingSlot.recurrence_type === tempRecurrence &&
      existingSlot.start_date
    ) {
      return existingSlot.start_date;
    }

    return todayString;
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

  const getSlotRecurrenceSummary = (slot: TimeSlot) => {
    switch (slot.recurrence_type || "repeat_weekly") {
      case "just_today":
        return "Just today";
      case "just_this_month":
        return `This month only${slot.start_date ? ` from ${slot.start_date}` : ""}`;
      case "specified_end_date":
        return slot.end_date
          ? `Until ${slot.end_date}`
          : "Specified end date";
      default:
        return "Repeats weekly";
    }
  };

  const getSlotServiceSummary = (slot: TimeSlot) => {
    const serviceIds = slot.service_ids || [];
    if (serviceIds.length === 0) {
      return services.length > 1 ? "All services" : "All service bookings";
    }

    const selectedServiceNames = services
      .filter((service) => serviceIds.includes(service.id))
      .map((service) => service.name);

    if (selectedServiceNames.length === 0) {
      return "Selected services";
    }

    return selectedServiceNames.join(", ");
  };

  const toggleServiceSelection = (serviceId: string) => {
    setTempSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  };

  const saveSlotEdit = () => {
    if (!editingSlot) return;

    const parsedStartTime = parseTwelveHourTime(tempStartTime);
    const parsedEndTime = parseTwelveHourTime(tempEndTime);

    if (!parsedStartTime || !parsedEndTime) {
      Alert.alert(
        "Invalid Time",
        "Please enter times in h:mm AM/PM format.",
      );
      return;
    }

    // Validate start < end
    const startParts = parsedStartTime.split(":").map(Number);
    const endParts = parsedEndTime.split(":").map(Number);
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
    const existingSlot =
      !isNewSlot && daySchedule && editingSlot.slotIndex !== null
        ? daySchedule.time_slots[editingSlot.slotIndex]
        : undefined;
    const effectiveStartDate = getEffectiveStartDate(existingSlot);
    const justTodayDate = formatDate(
      getNextOccurrenceForDay(today, editingSlot.dayIndex),
    );
    const useAllServices = services.length > 1 && tempSelectedServiceIds.length === 0;
    const selectedServiceIds =
      services.length <= 1
        ? services.map((service) => service.id)
        : useAllServices
          ? []
          : tempSelectedServiceIds;

    if (services.length > 1 && !useAllServices && selectedServiceIds.length === 0) {
      Alert.alert(
        "Select Services",
        "Choose at least one service or use All.",
      );
      return;
    }

    if (tempRecurrence === "specified_end_date" && !tempEndDate) {
      Alert.alert("End Date Required", "Please select an end date.");
      return;
    }

    if (
      tempRecurrence === "specified_end_date" &&
      tempEndDate < effectiveStartDate
    ) {
      Alert.alert(
        "Invalid End Date",
        "End date cannot be earlier than the start date.",
      );
      return;
    }

    let start_date: string | null = null;
    let end_date: string | null = null;

    if (tempRecurrence === "just_today") {
      start_date = justTodayDate;
      end_date = justTodayDate;
    } else if (tempRecurrence !== "repeat_weekly") {
      start_date = effectiveStartDate;
      if (tempRecurrence === "specified_end_date") {
        end_date = tempEndDate;
      }
    }

    const newSlot: TimeSlot = {
      start_time: parsedStartTime,
      end_time: parsedEndTime,
      session_duration: tempDuration,
      recurrence_type: tempRecurrence,
      start_date,
      end_date,
      service_ids: selectedServiceIds,
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
      await setAvailability({
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

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: themeColours.primary,
    inputBg: extendedColours.inputBg,
    error: SharedColours.error,
    success: SharedColours.success,
    warning: SharedColours.warning,
  };

  // Generate live preview for the modal
  const getPreview = () => {
    const parsedStartTime = parseTwelveHourTime(tempStartTime);
    const parsedEndTime = parseTwelveHourTime(tempEndTime);

    if (!parsedStartTime || !parsedEndTime) {
      return null;
    }

    const startParts = parsedStartTime.split(":").map(Number);
    const endParts = parsedEndTime.split(":").map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    if (startMinutes >= endMinutes) {
      return null;
    }

    return generateSessionsPreview(parsedStartTime, parsedEndTime, tempDuration);
  };

  const preview = editModalVisible ? getPreview() : null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colours.background }]}>
        <ActivityIndicator
          size="large"
          color={colours.accent}
          style={styles.loader}
        />
      </View>
    );
  }

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
        <Text style={[styles.title, { color: colours.text }]}>
          Manage Availability
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: 15 + insets.left,
            paddingRight: 15 + insets.right,
            paddingBottom: Math.max(insets.bottom, 16) + 96,
          },
        ]}
      >
        {DAYS.map((day, dayIndex) => {
          const daySchedule = getDaySchedule(dayIndex);

          return (
            <View
              key={dayIndex}
              style={[
                styles.dayCard,
                { backgroundColor: colours.card, borderColor: colours.border },
              ]}
            >
              <Text style={[styles.dayTitle, { color: colours.text }]}>
                {day}
              </Text>

              {daySchedule?.time_slots.map((slot, slotIndex) => (
                <TouchableOpacity
                  key={slotIndex}
                  style={[
                    styles.slotRow,
                    {
                      backgroundColor: colours.inputBg,
                      borderColor: colours.border,
                    },
                  ]}
                  onPress={() => openEditModal(dayIndex, slotIndex, slot)}
                >
                  <View style={styles.slotInfo}>
                    <Text style={[styles.slotTimeText, { color: colours.text }]}>
                      {formatStoredTimeRange(slot.start_time, slot.end_time)}
                    </Text>
                    <Text
                      style={[
                        styles.slotDurationText,
                        { color: colours.textMuted },
                      ]}
                    >
                      {slot.session_duration || 30} min sessions
                    </Text>
                    <Text
                      style={[
                        styles.slotRecurrenceText,
                        { color: colours.textMuted },
                      ]}
                    >
                      {getSlotRecurrenceSummary(slot)}
                    </Text>
                    <Text
                      style={[
                        styles.slotRecurrenceText,
                        { color: colours.textMuted },
                      ]}
                    >
                      {getSlotServiceSummary(slot)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeButton, { borderColor: colours.error }]}
                    onPress={() => removeTimeSlot(dayIndex, slotIndex)}
                  >
                    <Text
                      style={[styles.removeButtonText, { color: colours.error }]}
                    >
                      {"\u2715"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.addSlotButton, { borderColor: colours.accent }]}
                onPress={() => addTimeSlot(dayIndex)}
              >
                <Text style={[styles.addSlotText, { color: colours.accent }]}>
                  + Add Time Slot
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.saveButton,
          {
            backgroundColor: colours.accent,
            bottom: Math.max(insets.bottom, 16),
            left: 15 + insets.left,
            right: 15 + insets.right,
          },
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={UIColours.button.textLight} />
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
              { backgroundColor: colours.card, borderColor: colours.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colours.text }]}>
              {editingSlot?.slotIndex === null
                ? "Add Time Slot"
                : "Edit Time Slot"}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colours.textMuted }]}>
                Start Time
              </Text>
              <TextInput
                style={[
                  styles.timeInput,
                  { backgroundColor: colours.inputBg, color: colours.text },
                ]}
                value={tempStartTime}
                onChangeText={setTempStartTime}
                placeholder="9:00 AM"
                placeholderTextColor={colours.textMuted}
                maxLength={8}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colours.textMuted }]}>
                End Time
              </Text>
              <TextInput
                style={[
                  styles.timeInput,
                  { backgroundColor: colours.inputBg, color: colours.text },
                ]}
                value={tempEndTime}
                onChangeText={setTempEndTime}
                placeholder="5:00 PM"
                placeholderTextColor={colours.textMuted}
                maxLength={8}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colours.textMuted }]}>
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
                            ? colours.accent
                            : colours.inputBg,
                        borderColor: colours.border,
                      },
                    ]}
                    onPress={() => setTempDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        {
                          color:
                            tempDuration === duration
                              ? UIColours.button.textLight
                              : colours.text,
                        },
                      ]}
                    >
                      {duration}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colours.textMuted }]}>
                Recurrence
              </Text>
              <View style={styles.recurrenceOptions}>
                {recurrenceOptions.map((option) => {
                  const selected = tempRecurrence === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.recurrenceOption,
                        {
                          backgroundColor: selected
                            ? `${colours.accent}20`
                            : colours.inputBg,
                          borderColor: selected
                            ? colours.accent
                            : colours.border,
                        },
                      ]}
                      onPress={() => setTempRecurrence(option.value)}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          {
                            borderColor: selected
                              ? colours.accent
                              : colours.textMuted,
                          },
                        ]}
                      >
                        {selected && (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: colours.accent },
                            ]}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.recurrenceOptionText,
                          { color: colours.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colours.textMuted }]}>
                Apply To Services
              </Text>
              <View style={styles.serviceOptions}>
                {services.length > 1 && (
                  <TouchableOpacity
                    style={[
                      styles.serviceChip,
                      {
                        backgroundColor:
                          tempSelectedServiceIds.length === 0
                            ? `${colours.accent}20`
                            : colours.inputBg,
                        borderColor:
                          tempSelectedServiceIds.length === 0
                            ? colours.accent
                            : colours.border,
                      },
                    ]}
                    onPress={() => setTempSelectedServiceIds([])}
                  >
                    <Text
                      style={[
                        styles.serviceChipText,
                        {
                          color:
                            tempSelectedServiceIds.length === 0
                              ? colours.text
                              : colours.textMuted,
                        },
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                )}

                {services.map((service) => {
                  const selected = tempSelectedServiceIds.includes(service.id);
                  return (
                    <TouchableOpacity
                      key={service.id}
                      style={[
                        styles.serviceChip,
                        {
                          backgroundColor: selected
                            ? `${colours.accent}20`
                            : colours.inputBg,
                          borderColor: selected
                            ? colours.accent
                            : colours.border,
                        },
                      ]}
                      onPress={() => toggleServiceSelection(service.id)}
                    >
                      <Text
                        style={[
                          styles.serviceChipText,
                          {
                            color: selected ? colours.text : colours.textMuted,
                          },
                        ]}
                      >
                        {service.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {services.length === 0 && (
                <Text
                  style={[styles.helperText, { color: colours.textMuted }]}
                >
                  Add services first to target availability by service.
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colours.textMuted }]}>
                End Date
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateSelector,
                  {
                    backgroundColor:
                      tempRecurrence === "specified_end_date"
                        ? colours.inputBg
                        : `${colours.inputBg}99`,
                    borderColor: colours.border,
                    opacity: tempRecurrence === "specified_end_date" ? 1 : 0.55,
                  },
                ]}
                disabled={tempRecurrence !== "specified_end_date"}
                onPress={() => setDatePickerVisible(true)}
              >
                <Text
                  style={[
                    styles.dateSelectorText,
                    {
                      color:
                        tempRecurrence === "specified_end_date"
                          ? colours.text
                          : colours.textMuted,
                    },
                  ]}
                >
                  {tempEndDate || "Select end date"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Live Preview */}
            {preview && (
              <View
                style={[
                  styles.previewContainer,
                  {
                    backgroundColor: colours.inputBg,
                    borderColor: colours.border,
                  },
                ]}
              >
                <Text style={[styles.previewTitle, { color: colours.text }]}>
                  Sessions Preview
                </Text>
                <Text style={[styles.previewText, { color: colours.textMuted }]}>
                  {preview.sessionsCreated} session
                  {preview.sessionsCreated !== 1 ? "s" : ""} will be created
                </Text>
                {preview.sessions.length > 0 && (
                  <Text
                    style={[styles.previewSessions, { color: colours.text }]}
                  >
                    {preview.sessions
                      .slice(0, 4)
                      .map((s) => formatStoredTimeRange(s.start, s.end))
                      .join(", ")}
                    {preview.sessions.length > 4 &&
                      ` +${preview.sessions.length - 4} more`}
                  </Text>
                )}
                {preview.remainderMinutes > 0 && (
                  <View style={styles.warningBox}>
                    <Text
                      style={[styles.warningText, { color: colours.warning }]}
                    >
                      ⚠️ {preview.remainderMinutes} minutes will be unused
                    </Text>
                    <Text
                      style={[styles.warningHint, { color: colours.textMuted }]}
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
                  { backgroundColor: colours.inputBg },
                ]}
                onPress={() => {
                  setEditModalVisible(false);
                  setDatePickerVisible(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colours.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colours.accent }]}
                onPress={saveSlotEdit}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={datePickerVisible}
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.calendarModalContent,
              { backgroundColor: colours.card, borderColor: colours.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colours.text }]}>
              Select End Date
            </Text>
            <Calendar
              minDate={todayString}
              markedDates={{
                [tempEndDate]: {
                  selected: true,
                  selectedColor: colours.accent,
                },
              }}
              onDayPress={(day) => {
                setTempEndDate(day.dateString);
                setDatePickerVisible(false);
              }}
              theme={{
                calendarBackground: colours.card,
                dayTextColor: colours.text,
                monthTextColor: colours.text,
                textDisabledColor: colours.textMuted,
                todayTextColor: colours.accent,
                arrowColor: colours.accent,
                selectedDayTextColor: UIColours.button.textLight,
              }}
            />
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colours.inputBg }]}
              onPress={() => setDatePickerVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: colours.text }]}>
                Close
              </Text>
            </TouchableOpacity>
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
              { backgroundColor: colours.card },
            ]}
          >
            <View style={styles.successCircle}>
              <Text style={styles.successCheckmark}>✓</Text>
            </View>
            <Text style={[styles.successMessage, { color: colours.text }]}>
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
  slotRecurrenceText: {
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
    color: UIColours.button.textLight,
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
    backgroundColor: UIColours.overlay,
  },
  modalContent: {
    width: "90%",
    maxHeight: "92%",
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
  },
  calendarModalContent: {
    width: "92%",
    padding: 16,
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
  recurrenceOptions: {
    gap: 8,
  },
  recurrenceOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  recurrenceOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  serviceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serviceChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  serviceChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    marginTop: 8,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dateSelector: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateSelectorText: {
    fontSize: 15,
    textAlign: "center",
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
    color: UIColours.button.textLight,
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
    backgroundColor: UIColours.overlay,
  },
  successModalContent: {
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: UIColours.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SharedColours.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successCheckmark: {
    fontSize: 40,
    color: SharedColours.white,
    fontWeight: "bold",
  },
  successMessage: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
