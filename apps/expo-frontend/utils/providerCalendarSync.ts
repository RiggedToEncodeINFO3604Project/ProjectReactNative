import { BookingWithDetails } from "@/types/scheduling";
import * as Calendar from "expo-calendar";

const BOOKING_EVENT_PREFIX = "Booking:";

export const getWritableCalendar = async () => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") return null;

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );

  return (
    calendars.find(
      (calendar) =>
        calendar.allowsModifications && calendar.source?.isLocalAccount,
    ) ||
    calendars.find((calendar) => calendar.allowsModifications) ||
    null
  );
};

export const parseBookingDateTime = (date: string, time: string): Date => {
  const dateOnly = date.split("T")[0];
  const [hour, minute] = time.split(":").map(Number);
  const bookingDate = new Date(`${dateOnly}T00:00:00`);

  bookingDate.setHours(hour, minute, 0, 0);
  return bookingDate;
};

const getBookingEventTitle = (booking: BookingWithDetails) =>
  `${BOOKING_EVENT_PREFIX} ${booking.service_name}`;

const getBookingEventNotes = (booking: BookingWithDetails) => {
  const lines: string[] = [];

  if (booking.customer_name) {
    lines.push(`Customer: ${booking.customer_name}`);
  }

  if (booking.customer_phone) {
    lines.push(`Phone: ${booking.customer_phone}`);
  }

  return lines.join("\n");
};

const getBookingEventPayload = (booking: BookingWithDetails) => ({
  title: getBookingEventTitle(booking),
  startDate: parseBookingDateTime(booking.date, booking.start_time),
  endDate: parseBookingDateTime(booking.date, booking.end_time),
  notes: getBookingEventNotes(booking),
  timeZone: "UTC",
});

const matchesBookingNotes = (
  eventNotes: string | undefined,
  booking: BookingWithDetails,
) => {
  const expectedLines = getBookingEventNotes(booking)
    .split("\n")
    .filter(Boolean);

  if (expectedLines.length === 0) {
    return true;
  }

  const notes = eventNotes || "";
  return expectedLines.every((line) => notes.includes(line));
};

const findBookingCalendarEvent = async (
  booking: BookingWithDetails,
  calendarId: string,
) => {
  const bookingStart = parseBookingDateTime(booking.date, booking.start_time);
  const bookingEnd = parseBookingDateTime(booking.date, booking.end_time);
  const rangeStart = new Date(bookingStart);
  const rangeEnd = new Date(bookingEnd);

  rangeStart.setDate(rangeStart.getDate() - 1);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  const events = await Calendar.getEventsAsync(
    [calendarId],
    rangeStart,
    rangeEnd,
  );

  return (
    events.find((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();

      return (
        event.title === getBookingEventTitle(booking) &&
        eventStart === bookingStart.getTime() &&
        eventEnd === bookingEnd.getTime() &&
        matchesBookingNotes(event.notes, booking)
      );
    }) || null
  );
};

export const addBookingToDeviceCalendar = async (
  booking: BookingWithDetails,
  calendarId?: string,
) => {
  const writableCalendar = calendarId
    ? { id: calendarId }
    : await getWritableCalendar();

  if (!writableCalendar) {
    return false;
  }

  await Calendar.createEventAsync(
    writableCalendar.id,
    getBookingEventPayload(booking),
  );

  return true;
};

export const syncRescheduledBookingInCalendar = async (
  previousBooking: BookingWithDetails,
  updatedBooking: BookingWithDetails,
) => {
  const writableCalendar = await getWritableCalendar();

  if (!writableCalendar) {
    return false;
  }

  const existingEvent = await findBookingCalendarEvent(
    previousBooking,
    writableCalendar.id,
  );

  if (existingEvent) {
    await Calendar.updateEventAsync(
      existingEvent.id,
      getBookingEventPayload(updatedBooking),
    );
    return true;
  }

  await Calendar.createEventAsync(
    writableCalendar.id,
    getBookingEventPayload(updatedBooking),
  );

  return true;
};
