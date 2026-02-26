import * as Calendar from "expo-calendar";
import React, { useEffect, useState } from "react";
import { Alert, Button, FlatList, StyleSheet, Text, View } from "react-native";
import { CalendarList } from "react-native-calendars";

export default function CalendarScreen() {
  const [events, setEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    requestPermissionAndLoadEvents();
  }, []);

  const calendarTheme = {
    backgroundColor: "#000",
    calendarBackground: "#000",
    textSectionTitleColor: "#aaa",
    dayTextColor: "#fff",
    todayTextColor: "#0f0",
    selectedDayBackgroundColor: "#6366F1",
    selectedDayTextColor: "#fff",
    arrowColor: "white",
    monthTextColor: "white",
    textDisabledColor: "#555",
  };

  const requestPermissionAndLoadEvents = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Calendar access is needed to show your events.",
      );
      return;
    }
    setPermissionGranted(true);
    loadEvents();
  };

  const loadEvents = async () => {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    const calendarIds = calendars.map((cal) => cal.id);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);

    const fetchedEvents = await Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate,
    );
    setEvents(fetchedEvents);

    const marks = {};
    fetchedEvents.forEach((event) => {
      const dateKey = event.startDate.split("T")[0];
      marks[dateKey] = { marked: true, dotColor: "#50cebb" };
    });
    setMarkedDates(marks);
  };

  const createEvent = async () => {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    const writableCalendar =
      calendars.find(
        (cal) => cal.allowsModifications && cal.source?.isLocalAccount,
      ) || calendars.find((cal) => cal.allowsModifications);

    if (!writableCalendar) {
      Alert.alert("No writable calendar found");
      return;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(10, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(11, 0, 0);

    try {
      const eventId = await Calendar.createEventAsync(writableCalendar.id, {
        title: "Test Event from My App",
        startDate,
        endDate,
        notes: "Created from SkeduleIt",
        timeZone: "GMT",
      });
      Alert.alert("Success", `Event created and added`);
      loadEvents();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const renderEvent = ({ item }) => (
    <View style={styles.eventItem}>
      <Text style={styles.eventTitle}>Unavailable</Text>
      <Text style={styles.eventDate}>
        {new Date(item.startDate).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderEvent}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>My Calendar</Text>
            <CalendarList
              theme={calendarTheme}
              style={styles.calendar}
              markingType={"dot"}
              markedDates={markedDates}
              onDayPress={(day) => {
                const dayEvents = events.filter((e) =>
                  e.startDate.startsWith(day.dateString),
                );
                const names =
                  dayEvents.length > 0 ? "Unavailable" : "No events";
                Alert.alert(`Events on ${day.dateString}`, names);
              }}
              pastScrollRange={1}
              futureScrollRange={3}
              scrollEnabled={false}
              showScrollIndicator={false}
            />
            <Button
              title="Add test event to check write feature"
              onPress={createEvent}
            />
            <Text style={styles.subtitle}>Upcoming Events</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No upcoming events found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#432033",
  },
  container: { flex: 1, backgroundColor: "#432033" },
  title: { fontSize: 24, fontWeight: "bold", padding: 16 },
  subtitle: { fontSize: 18, fontWeight: "600", padding: 16 },
  eventItem: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  eventTitle: { fontSize: 16, fontWeight: "500" },
  eventDate: { fontSize: 13, color: "#666", marginTop: 4 },
  empty: { textAlign: "center", color: "#999", padding: 20 },
});
