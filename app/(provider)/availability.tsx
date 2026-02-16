import { useTheme } from "@/context/ThemeContext";
import { getAvailability, setAvailability } from "@/services/schedulingApi";
import { DayAvailability, TimeSlot } from "@/types/scheduling";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
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

export default function ManageAvailabilityScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [schedule, setSchedule] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const addTimeSlot = (dayIndex: number) => {
    const newSlot: TimeSlot = { start_time: "09:00", end_time: "17:00" };
    const newSchedule = [...schedule];
    const existingDay = newSchedule.find((d) => d.day_of_week === dayIndex);

    if (existingDay) {
      existingDay.time_slots.push(newSlot);
    } else {
      newSchedule.push({ day_of_week: dayIndex, time_slots: [newSlot] });
    }

    setSchedule(newSchedule);
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

  const updateTimeSlot = (
    dayIndex: number,
    slotIndex: number,
    field: "start_time" | "end_time",
    value: string,
  ) => {
    const newSchedule = [...schedule];
    const daySchedule = newSchedule.find((d) => d.day_of_week === dayIndex);

    if (daySchedule && daySchedule.time_slots[slotIndex]) {
      daySchedule.time_slots[slotIndex][field] = value;
    }

    setSchedule(newSchedule);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setAvailability({
        providerId: "",
        schedule,
      });
      Alert.alert("Success", "Availability saved successfully");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to save availability",
      );
    } finally {
      setSaving(false);
    }
  };

  const getDaySchedule = (dayIndex: number): DayAvailability | undefined => {
    return schedule.find((d) => d.day_of_week === dayIndex);
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
  };

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
            ← Back
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
                <View key={slotIndex} style={styles.slotRow}>
                  <Text style={[styles.slotText, { color: colors.textMuted }]}>
                    {slot.start_time} - {slot.end_time}
                  </Text>
                  <TouchableOpacity
                    style={[styles.removeButton, { borderColor: colors.error }]}
                    onPress={() => removeTimeSlot(dayIndex, slotIndex)}
                  >
                    <Text
                      style={[styles.removeButtonText, { color: colors.error }]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
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
    paddingVertical: 8,
  },
  slotText: {
    fontSize: 14,
  },
  removeButton: {
    padding: 5,
    borderRadius: 5,
    borderWidth: 1,
  },
  removeButtonText: {
    fontSize: 14,
  },
  addSlotButton: {
    marginTop: 10,
    padding: 10,
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
});
