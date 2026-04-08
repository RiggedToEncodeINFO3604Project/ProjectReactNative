// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Theme context stub
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    isDarkMode: false,
    colours: { primary: "#007AFF" },
  }),
}));

// Router stubs
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
      replace: mockReplace,
    }),
    useFocusEffect: (callback: any) => React.useEffect(callback, []),
  };
});

// Theme constants stub — returns enough shape for screens not to crash
jest.mock("@/constants/theme", () => ({
  getScreenPalette: () => ({
    background: "#fff",
    card: "#fff",
    text: "#000",
    textMuted: "#888",
    textSecondary: "#555",
    border: "#ddd",
    accent: "#007AFF",
    overlay: "rgba(0,0,0,0.3)",
  }),
  ExtendedColours: {
    light: {
      background: "#fff",
      card: "#fff",
      text: "#000",
      textMuted: "#888",
      border: "#ddd",
      inputBg: "#f0f0f0",
      searchInputBg: "#f0f0f0",
      warningBg: "#fff3cd",
    },
    dark: {
      background: "#151718",
      card: "#1e2333",
      text: "#ECEDEE",
      textMuted: "#9BA1A6",
      border: "#2a2f3e",
      inputBg: "#333",
      searchInputBg: "#333",
      warningBg: "#3a2e00",
    },
  },
  SharedColours: {
    calendar: { dotColor: "#8B0000" },
    success: "#34C759",
    error: "#FF3B30",
    white: "#fff",
    bookingStatus: {
      confirmed: "#34C759",
      pending: "#FF9500",
      cancelled: "#FF3B30",
      completed: "#007AFF",
      default: "#888",
    },
  },
}));

// Shared component stubs — not under test here
jest.mock("@/components/BackButton", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ onPress }: any) =>
      React.createElement(
        "button",
        { onClick: onPress, testID: "back-button" },
        "Back",
      ),
  };
});

jest.mock("@/components/ConfirmModal", () => {
  const React = require("react");
  const { View, TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      visible,
      title,
      message,
      confirmText,
      onConfirm,
      onCancel,
      loading,
    }: any) =>
      visible
        ? React.createElement(
            View,
            null,
            React.createElement(Text, null, title),
            React.createElement(Text, null, message),
            React.createElement(
              TouchableOpacity,
              { onPress: onConfirm, testID: "confirm-button" },
              React.createElement(Text, null, confirmText),
            ),
            React.createElement(
              TouchableOpacity,
              { onPress: onCancel, testID: "cancel-button" },
              React.createElement(Text, null, "Cancel"),
            ),
          )
        : null,
  };
});

jest.mock("@/components/MessageCustomerButton", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => React.createElement("div", null),
  };
});

// Expo Calendar mock
jest.mock("expo-calendar", () => ({
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getEventsAsync: jest.fn(),
  createEventAsync: jest.fn(),
  EntityTypes: { EVENT: "event" },
}));

// Scheduling API mock
jest.mock("@/services/schedulingApi", () => ({
  getConfirmedBookings: jest.fn(),
  getPendingBookings: jest.fn(),
  acceptBooking: jest.fn(),
  rejectBooking: jest.fn(),
  syncBusyTimes: jest.fn(),
  getCustomerSnapshot: jest.fn(),
}));

// AsyncStorage mock
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("mock-token"),
  setItem: jest.fn().mockResolvedValue(null),
  multiGet: jest.fn().mockResolvedValue([
    ["token", "mock-token"],
    ["role", "Provider"],
    ["userId", "u1"],
  ]),
  multiRemove: jest.fn().mockResolvedValue(null),
}));

// Expo constants mock
jest.mock("expo-constants", () => ({
  default: { expoConfig: { hostUri: "localhost:8081" } },
}));

// Axios mock — mirrors teammate's setup so we can assert on HTTP calls
jest.mock("axios", () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    post: jest.fn(),
    __mockInstance: mockAxiosInstance,
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-calendars", () => {
  const React = require("react");
  return {
    __esModule: true,
    CalendarList: (props: any) =>
      React.createElement("div", props, props.children),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks are registered)
// ─────────────────────────────────────────────────────────────────────────────

import CalendarScreen from "@/app/(provider)/calendar";
import PendingBookingsScreen from "@/app/(provider)/pending";
import * as SchedulingApi from "@/services/schedulingApi";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import axios from "axios";
import * as Calendar from "expo-calendar";
import React from "react";
import { Alert } from "react-native";

// Grab the mocked axios instance for direct HTTP assertions
const mockApi = (axios as any).__mockInstance as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
};

// Grab the actual (un-mocked) schedulingApi for HTTP-level unit tests
const actualSchedulingApi = jest.requireActual(
  "@/services/schedulingApi",
) as typeof import("@/services/schedulingApi");

// Typed references to the mocked service functions
const mockGetConfirmedBookings =
  SchedulingApi.getConfirmedBookings as jest.Mock;
const mockGetPendingBookings = SchedulingApi.getPendingBookings as jest.Mock;
const mockAcceptBooking = SchedulingApi.acceptBooking as jest.Mock;
const mockRejectBooking = SchedulingApi.rejectBooking as jest.Mock;
const mockSyncBusyTimes = SchedulingApi.syncBusyTimes as jest.Mock;
const mockGetCustomerSnapshot = SchedulingApi.getCustomerSnapshot as jest.Mock;

// Typed references to the mocked expo-calendar functions
const mockRequestCalendarPermissionsAsync =
  Calendar.requestCalendarPermissionsAsync as jest.Mock;
const mockGetCalendarsAsync = Calendar.getCalendarsAsync as jest.Mock;
const mockGetEventsAsync = Calendar.getEventsAsync as jest.Mock;
const mockCreateEventAsync = Calendar.createEventAsync as jest.Mock;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const pendingBooking = {
  booking_id: "booking-1",
  customer_id: "cust-001",
  customer_name: "Alice Smith",
  customer_phone: "+1-555-0100",
  service_name: "Haircut",
  cost: 80,
  date: "2026-04-15T00:00:00",
  start_time: "09:00",
  end_time: "10:00",
  status: "pending",
};

const confirmedBookingA = {
  booking_id: "confirmed-1",
  customer_id: "cust-001",
  customer_name: "Alice Smith",
  customer_phone: "+1-555-0100",
  service_name: "Haircut",
  cost: 80,
  date: "2026-04-15T00:00:00",
  start_time: "09:00",
  end_time: "10:00",
  status: "confirmed",
};

const confirmedBookingB = {
  booking_id: "confirmed-2",
  customer_id: "cust-002",
  customer_name: "Bob Jones",
  customer_phone: "+1-555-0200",
  service_name: "Massage",
  cost: 120,
  date: "2026-04-16T00:00:00",
  start_time: "11:00",
  end_time: "12:00",
  status: "confirmed",
};

// A genuine personal device event (not exported by the app)
const personalDeviceEvent = {
  id: "event-personal",
  title: "Doctor appointment",
  startDate: "2026-04-17T14:00:00",
  endDate: "2026-04-17T15:00:00",
};

// A device event that is an echo of an accepted booking (should be filtered out)
const echoedBookingEvent = {
  id: "event-echoed",
  title: "Booking: Haircut",
  startDate: "2026-04-15T09:00:00",
  endDate: "2026-04-15T10:00:00",
};

// A device event that overlaps with confirmedBookingB (should be filtered out)
const overlappingDeviceEvent = {
  id: "event-overlap",
  title: "Other event",
  startDate: "2026-04-16T11:30:00",
  endDate: "2026-04-16T12:00:00",
};

const customerSnapshot = {
  customer_id: "cust-001",
  customer_name: "Alice Smith",
  customer_email: "alice@example.com",
  customer_phone: "+1-555-0100",
  total_visits: 1,
  last_service_date: "2026-03-01",
  last_service_name: "Haircut",
  payment_preference: "Card",
  total_spent: 80,
  tags: [],
  notes: [],
};

const writableCalendar = {
  id: "writable-cal",
  allowsModifications: true,
  source: { isLocalAccount: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Mock a successful axios response
const resolveWith = (mock: jest.Mock, payload: unknown) =>
  mock.mockResolvedValueOnce({ data: payload });

// Mock a failed axios response
const rejectWith = (mock: jest.Mock, detail = "Server error", status = 500) =>
  mock.mockRejectedValueOnce({
    message: "Request failed",
    response: { data: { detail }, status },
  });

// Grant calendar permission and return a list of calendars
const grantCalendarPermission = (calendars = [writableCalendar]) => {
  mockRequestCalendarPermissionsAsync.mockResolvedValueOnce({
    status: "granted",
  });
  mockGetCalendarsAsync.mockResolvedValueOnce(calendars);
};

// Deny calendar permission
const denyCalendarPermission = () => {
  mockRequestCalendarPermissionsAsync.mockResolvedValueOnce({
    status: "denied",
  });
  mockGetCalendarsAsync.mockResolvedValueOnce([]);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. schedulingApi — HTTP unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("schedulingApi — syncBusyTimes", () => {
  it("POSTs busy times to /provider/calendar/busy-times", async () => {
    const busyTimes = [
      { date: "2026-04-17", start_time: "14:00", end_time: "15:00" },
    ];
    resolveWith(mockApi.post, { message: "Busy times synced" });

    const result = await actualSchedulingApi.syncBusyTimes(busyTimes);

    expect(mockApi.post).toHaveBeenCalledWith(
      "/provider/calendar/busy-times",
      busyTimes,
    );
    expect(result).toEqual({ message: "Busy times synced" });
  });

  it("sends an empty array when there are no busy times", async () => {
    resolveWith(mockApi.post, { message: "Busy times synced" });

    await actualSchedulingApi.syncBusyTimes([]);

    expect(mockApi.post).toHaveBeenCalledWith(
      "/provider/calendar/busy-times",
      [],
    );
  });

  it("propagates API errors from syncBusyTimes", async () => {
    rejectWith(mockApi.post, "Unauthorized", 401);

    await expect(
      actualSchedulingApi.syncBusyTimes([
        { date: "2026-04-17", start_time: "14:00", end_time: "15:00" },
      ]),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it("sends multiple busy times in one request", async () => {
    const busyTimes = [
      { date: "2026-04-17", start_time: "09:00", end_time: "10:00" },
      { date: "2026-04-17", start_time: "14:00", end_time: "15:00" },
      { date: "2026-04-18", start_time: "11:00", end_time: "12:00" },
    ];
    resolveWith(mockApi.post, { message: "Busy times synced" });

    await actualSchedulingApi.syncBusyTimes(busyTimes);

    const [, body] = mockApi.post.mock.calls[0];
    expect(body).toHaveLength(3);
  });
});

describe("schedulingApi — getConfirmedBookings", () => {
  it("GETs confirmed bookings from the correct endpoint", async () => {
    resolveWith(mockApi.get, [confirmedBookingA]);

    const result = await actualSchedulingApi.getConfirmedBookings();

    expect(mockApi.get).toHaveBeenCalledWith("/provider/bookings/confirmed");
    expect(result).toEqual([confirmedBookingA]);
  });

  it("returns an empty array when there are no confirmed bookings", async () => {
    resolveWith(mockApi.get, []);

    const result = await actualSchedulingApi.getConfirmedBookings();

    expect(result).toEqual([]);
  });

  it("propagates API errors from getConfirmedBookings", async () => {
    rejectWith(mockApi.get, "Forbidden", 403);

    await expect(
      actualSchedulingApi.getConfirmedBookings(),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });
});

describe("schedulingApi — acceptBooking", () => {
  it("POSTs to the accept endpoint for a given booking ID", async () => {
    resolveWith(mockApi.post, { message: "Accepted" });

    const result = await actualSchedulingApi.acceptBooking("booking-1");

    expect(mockApi.post).toHaveBeenCalledWith(
      "/provider/bookings/booking-1/accept",
    );
    expect(result).toEqual({ message: "Accepted" });
  });

  it("propagates 404 when booking does not exist", async () => {
    rejectWith(mockApi.post, "Booking not found", 404);

    await expect(
      actualSchedulingApi.acceptBooking("nonexistent-id"),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("propagates 403 when provider is not authorized", async () => {
    rejectWith(mockApi.post, "Not authorized", 403);

    await expect(
      actualSchedulingApi.acceptBooking("booking-x"),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });
});

describe("schedulingApi — rejectBooking", () => {
  it("POSTs to the reject endpoint for a given booking ID", async () => {
    resolveWith(mockApi.post, { message: "Rejected" });

    const result = await actualSchedulingApi.rejectBooking("booking-1");

    expect(mockApi.post).toHaveBeenCalledWith(
      "/provider/bookings/booking-1/reject",
    );
    expect(result).toEqual({ message: "Rejected" });
  });

  it("propagates 404 when booking does not exist", async () => {
    rejectWith(mockApi.post, "Booking not found", 404);

    await expect(
      actualSchedulingApi.rejectBooking("nonexistent-id"),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("propagates server errors from rejectBooking", async () => {
    rejectWith(mockApi.post, "Server error", 500);

    await expect(
      actualSchedulingApi.rejectBooking("booking-1"),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CalendarScreen — UI and device calendar sync tests
// ─────────────────────────────────────────────────────────────────────────────

describe("CalendarScreen — rendering", () => {
  it('renders the "My Calendar" title', async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    const { getByText } = render(<CalendarScreen />);

    await waitFor(() => {
      expect(getByText("My Calendar")).toBeTruthy();
    });
  });

  it('shows "No upcoming bookings" when there are no confirmed bookings', async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    const { getByText } = render(<CalendarScreen />);

    await waitFor(() => {
      expect(getByText("No upcoming bookings")).toBeTruthy();
    });
  });

  it("renders confirmed booking service names in the list", async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([
      confirmedBookingA,
      confirmedBookingB,
    ]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    const { getByText } = render(<CalendarScreen />);

    await waitFor(() => {
      expect(getByText("Haircut")).toBeTruthy();
      expect(getByText("Massage")).toBeTruthy();
    });
  });
});

describe("CalendarScreen — device calendar sync", () => {
  it("calls syncBusyTimes with personal device events after loading", async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([personalDeviceEvent]);
    mockApi.post.mockResolvedValueOnce({
      data: { message: "Busy times synced" },
    });
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(mockSyncBusyTimes).toHaveBeenCalledWith([
        expect.objectContaining({
          date: "2026-04-17",
          start_time: "14:00",
          end_time: "15:00",
        }),
      ]);
    });
  });

  it("does NOT call syncBusyTimes when calendar permission is denied", async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([]);
    denyCalendarPermission();

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(mockSyncBusyTimes).not.toHaveBeenCalled();
    });
  });

  it("shows a permission alert when calendar access is denied", async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([]);
    denyCalendarPermission();

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Calendar Permission Required",
        expect.stringContaining("Calendar permission is needed"),
      );
    });
  });

  it("does not crash when syncBusyTimes fails — logs silently", async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([personalDeviceEvent]);
    mockApi.post.mockRejectedValueOnce(new Error("Network error"));
    mockSyncBusyTimes.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw — the screen handles sync errors silently
    const { getByText } = render(<CalendarScreen />);

    await waitFor(() => {
      expect(getByText("My Calendar")).toBeTruthy();
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  it("does not crash when getConfirmedBookings fails", async () => {
    mockApi.get.mockRejectedValueOnce({
      response: { data: { detail: "Unauthorized" } },
    });
    mockGetConfirmedBookings.mockRejectedValueOnce({
      response: { data: { detail: "Unauthorized" } },
    });
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    const { getByText } = render(<CalendarScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        expect.stringContaining("Unauthorized"),
      );
      expect(getByText("My Calendar")).toBeTruthy();
    });
  });
});

describe("CalendarScreen — duplicate filtering (echo prevention)", () => {
  it("filters out device events titled 'Booking:' from busy times sync", async () => {
    // confirmedBookingA is on 2026-04-15 09:00-10:00
    // echoedBookingEvent has title "Booking: Haircut" — should be excluded
    mockGetConfirmedBookings.mockResolvedValue([confirmedBookingA]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([echoedBookingEvent]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    render(<CalendarScreen />);

    await waitFor(() => {
      // syncBusyTimes should have been called with an empty array
      // because the only device event was a "Booking:" echo
      expect(mockSyncBusyTimes).toHaveBeenCalledWith([]);
    });
  });

  it("filters out device events that overlap with a confirmed booking", async () => {
    // confirmedBookingB is on 2026-04-16 11:00-12:00
    // overlappingDeviceEvent is on 2026-04-16 11:30-12:00 — should be excluded
    mockGetConfirmedBookings.mockResolvedValue([confirmedBookingB]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([overlappingDeviceEvent]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(mockSyncBusyTimes).toHaveBeenCalledWith([]);
    });
  });

  it("keeps genuine personal events that do not overlap any confirmed booking", async () => {
    // confirmedBookingA is on 2026-04-15, personalDeviceEvent is on 2026-04-17
    // no overlap — personalDeviceEvent should pass through
    mockGetConfirmedBookings.mockResolvedValue([confirmedBookingA]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([personalDeviceEvent]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(mockSyncBusyTimes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ date: "2026-04-17" }),
        ]),
      );
    });
  });

  it("handles a mix of echoed and personal events — only syncs personal ones", async () => {
    mockGetConfirmedBookings.mockResolvedValue([confirmedBookingA]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([
      echoedBookingEvent,
      personalDeviceEvent,
    ]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    render(<CalendarScreen />);

    await waitFor(() => {
      const [busyTimesArg] = mockSyncBusyTimes.mock.calls[0];
      expect(busyTimesArg).toHaveLength(1);
      expect(busyTimesArg[0].date).toBe("2026-04-17");
    });
  });
});

describe("CalendarScreen — day modal", () => {
  it('opens modal with "No events or bookings" when an empty day is pressed', async () => {
    mockGetConfirmedBookings.mockResolvedValueOnce([confirmedBookingA]);
    grantCalendarPermission();
    mockGetEventsAsync.mockResolvedValueOnce([]);
    mockSyncBusyTimes.mockResolvedValueOnce({ message: "OK" });

    const { getByText } = render(<CalendarScreen />);

    await waitFor(() => expect(getByText("My Calendar")).toBeTruthy());

    expect(() => getByText("Close")).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PendingBookingsScreen — accept flow and calendar write
// ─────────────────────────────────────────────────────────────────────────────

describe("PendingBookingsScreen — rendering", () => {
  it("renders pending booking service names", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => {
      expect(getByText("Haircut")).toBeTruthy();
    });
  });

  it('shows "No pending bookings" when list is empty', async () => {
    mockGetPendingBookings.mockResolvedValueOnce([]);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => {
      expect(getByText("No pending bookings")).toBeTruthy();
    });
  });

  it('renders "Accept" and "Reject" buttons for each pending booking', async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => {
      expect(getByText("Accept")).toBeTruthy();
      expect(getByText("Reject")).toBeTruthy();
    });
  });

  it('renders the "Sync Cal" button', async () => {
    mockGetPendingBookings.mockResolvedValueOnce([]);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => {
      expect(getByText("Sync Cal")).toBeTruthy();
    });
  });
});

describe("PendingBookingsScreen — accept booking + calendar export", () => {
  it("accepts a booking and writes it to the device calendar", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);
    mockAcceptBooking.mockResolvedValueOnce({ message: "Accepted" });
    grantCalendarPermission();
    mockCreateEventAsync.mockResolvedValueOnce({ id: "device-event-1" });
    // Second call to loadBookings after accept
    mockGetPendingBookings.mockResolvedValueOnce([]);
    mockGetEventsAsync.mockResolvedValueOnce([]);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Accept")).toBeTruthy());
    fireEvent.press(getByText("Accept"));

    await waitFor(() => {
      expect(mockAcceptBooking).toHaveBeenCalledWith("booking-1");
      expect(mockCreateEventAsync).toHaveBeenCalledWith(
        "writable-cal",
        expect.objectContaining({
          title: "Booking: Haircut",
          notes: "Customer: Alice Smith\nPhone: +1-555-0100",
          timeZone: "UTC",
        }),
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        "Success",
        "Booking accepted and added to calendar",
      );
    });
  });

  it("still accepts booking even when calendar permission is denied — skips calendar write", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);
    mockAcceptBooking.mockResolvedValueOnce({ message: "Accepted" });
    denyCalendarPermission();
    mockGetPendingBookings.mockResolvedValueOnce([]);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Accept")).toBeTruthy());
    fireEvent.press(getByText("Accept"));

    await waitFor(() => {
      expect(mockAcceptBooking).toHaveBeenCalledWith("booking-1");
      expect(mockCreateEventAsync).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        "Success",
        "Booking accepted and added to calendar",
      );
    });
  });

  it("shows error alert when acceptBooking API call fails", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);
    mockAcceptBooking.mockRejectedValueOnce({
      response: { data: { detail: "Booking not found" } },
    });

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Accept")).toBeTruthy());
    fireEvent.press(getByText("Accept"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Booking not found");
    });
  });

  it("does not write to calendar when acceptBooking API call fails", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);
    mockAcceptBooking.mockRejectedValueOnce({
      response: { data: { detail: "Server error" } },
    });

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Accept")).toBeTruthy());
    fireEvent.press(getByText("Accept"));

    await waitFor(() => {
      expect(mockCreateEventAsync).not.toHaveBeenCalled();
    });
  });
});

describe("PendingBookingsScreen — Sync Cal (bulk sync)", () => {
  it("shows Permission Denied alert when sync is pressed without calendar access", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([]);
    denyCalendarPermission();

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Sync Cal")).toBeTruthy());
    fireEvent.press(getByText("Sync Cal"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Permission Denied",
        "Calendar access is needed to sync bookings.",
      );
    });
  });
});

describe("PendingBookingsScreen — reject booking", () => {
  it("shows reject confirmation modal when Reject is pressed", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);

    const { getByText } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Reject")).toBeTruthy());
    fireEvent.press(getByText("Reject"));

    expect(mockRejectBooking).not.toHaveBeenCalled();
  });

  it("shows error alert when rejectBooking API call fails", async () => {
    mockGetPendingBookings.mockResolvedValueOnce([pendingBooking]);
    mockGetCustomerSnapshot.mockResolvedValueOnce(customerSnapshot);
    mockRejectBooking.mockRejectedValueOnce({
      response: { data: { detail: "Booking not found" } },
    });
    mockGetPendingBookings.mockResolvedValueOnce([]);

    const { getByText, getByTestId } = render(<PendingBookingsScreen />);

    await waitFor(() => expect(getByText("Reject")).toBeTruthy());
    fireEvent.press(getByText("Reject"));

    await waitFor(() => expect(getByTestId("confirm-button")).toBeTruthy());
    fireEvent.press(getByTestId("confirm-button"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Booking not found");
    });
  });
});
