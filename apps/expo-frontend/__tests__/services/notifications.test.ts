var mockGetItem = jest.fn();
var mockSetItem = jest.fn();
var mockRemoveItem = jest.fn();

var mockSetNotificationHandler = jest.fn();
var mockGetPermissionsAsync = jest.fn();
var mockRequestPermissionsAsync = jest.fn();
var mockSetNotificationChannelAsync = jest.fn();
var mockScheduleNotificationAsync = jest.fn();
var mockCancelScheduledNotificationAsync = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: mockRemoveItem,
}));

jest.mock("@/services/schedulingApi", () => ({
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
}));

jest.mock("@/config/publicEnv", () => ({
  publicEnv: {
    EXPO_PUBLIC_EAS_PROJECT_ID: "project-id",
  },
}));

jest.mock("expo-constants", () => ({
  easConfig: { projectId: "project-id" },
  expoConfig: { extra: { eas: { projectId: "project-id" } } },
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

jest.mock("expo-notifications", () => ({
  __esModule: true,
  AndroidImportance: {
    HIGH: "high",
    MAX: "max",
  },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
  },
  SchedulableTriggerInputTypes: {
    DATE: "date",
  },
  setNotificationHandler: mockSetNotificationHandler,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
}));

type BookingWithDetails = import("@/types/scheduling").BookingWithDetails;

const {
  shouldRefreshBookingRemindersFromNotification,
  syncScheduledBookingReminders,
} = require("@/services/notifications");

const makeBooking = (
  overrides: Partial<BookingWithDetails> = {},
): BookingWithDetails => ({
  booking_id: "booking-1",
  customer_id: "customer-1",
  date: "2026-04-14",
  start_time: "15:00",
  end_time: "15:30",
  cost: 55,
  status: "confirmed",
  service_name: "Haircut",
  provider_name: "Kai Styles",
  ...overrides,
});

describe("syncScheduledBookingReminders", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-13T10:00:00"));

    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockScheduleNotificationAsync
      .mockResolvedValueOnce("day-before-id")
      .mockResolvedValueOnce("two-hours-id");
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("schedules a day-before reminder and a two-hour reminder for confirmed bookings", async () => {
    await syncScheduledBookingReminders([makeBooking()]);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Appointment tomorrow",
          data: expect.objectContaining({
            bookingId: "booking-1",
            reminderType: "day_before",
          }),
        }),
        trigger: expect.objectContaining({
          type: "date",
          date: new Date("2026-04-13T15:00:00"),
          channelId: "appointments",
        }),
      }),
    );
    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Appointment in 2 hours",
          data: expect.objectContaining({
            bookingId: "booking-1",
            reminderType: "two_hours_before",
          }),
        }),
        trigger: expect.objectContaining({
          type: "date",
          date: new Date("2026-04-14T13:00:00"),
          channelId: "appointments",
        }),
      }),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "scheduledBookingReminders",
      JSON.stringify({
        "booking-1": {
          fingerprint:
            "confirmed|2026-04-14|15:00|15:30|Haircut|Kai Styles|",
          notificationIds: ["day-before-id", "two-hours-id"],
        },
      }),
    );
  });

  it("cancels stored reminders when a booking is no longer eligible", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        "booking-1": {
          fingerprint: "old-fingerprint",
          notificationIds: ["old-1", "old-2"],
        },
      }),
    );

    await syncScheduledBookingReminders([
      makeBooking({ status: "cancelled" }),
    ]);

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      1,
      "old-1",
    );
    expect(mockCancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      2,
      "old-2",
    );
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith(
      "scheduledBookingReminders",
      JSON.stringify({}),
    );
  });

  it("replaces stored reminders when a booking is rescheduled", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        "booking-1": {
          fingerprint:
            "confirmed|2026-04-14|15:00|15:30|Haircut|Kai Styles|",
          notificationIds: ["old-day-before-id", "old-two-hours-id"],
        },
      }),
    );
    mockScheduleNotificationAsync.mockReset();
    mockScheduleNotificationAsync
      .mockResolvedValueOnce("new-day-before-id")
      .mockResolvedValueOnce("new-two-hours-id");

    await syncScheduledBookingReminders([
      makeBooking({
        date: "2026-04-15",
        start_time: "16:00",
        end_time: "16:30",
      }),
    ]);

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      1,
      "old-day-before-id",
    );
    expect(mockCancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      2,
      "old-two-hours-id",
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockSetItem).toHaveBeenCalledWith(
      "scheduledBookingReminders",
      JSON.stringify({
        "booking-1": {
          fingerprint:
            "confirmed|2026-04-15|16:00|16:30|Haircut|Kai Styles|",
          notificationIds: ["new-day-before-id", "new-two-hours-id"],
        },
      }),
    );
  });
});

describe("shouldRefreshBookingRemindersFromNotification", () => {
  it("returns true for booking reschedule notifications", () => {
    expect(
      shouldRefreshBookingRemindersFromNotification({
        type: "booking_rescheduled",
      }),
    ).toBe(true);
  });

  it("returns false for unrelated notification payloads", () => {
    expect(
      shouldRefreshBookingRemindersFromNotification({
        type: "chat_message",
      }),
    ).toBe(false);
    expect(shouldRefreshBookingRemindersFromNotification(null)).toBe(false);
  });
});
