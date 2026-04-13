import { registerPushToken, unregisterPushToken } from "@/services/schedulingApi";
import { BookingWithDetails } from "@/types/scheduling";
import { formatStoredTimeRange, parseLocalDate } from "@/utils/time";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { publicEnv } from "@/config/publicEnv";

const DEVICE_PUSH_TOKEN_STORAGE_KEY = "devicePushToken";
const BOOKING_REMINDER_STORAGE_KEY = "scheduledBookingReminders";
const APPOINTMENT_CHANNEL_ID = "appointments";
const REMINDER_DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDER_TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;

type ReminderType = "day_before" | "two_hours_before";

interface ScheduledBookingReminderRecord {
  fingerprint: string;
  notificationIds: string[];
}

type ScheduledBookingReminderMap = Record<
  string,
  ScheduledBookingReminderRecord
>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const isNativePlatform = Platform.OS === "android" || Platform.OS === "ios";

const configureNotificationChannelsAsync = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0EA5E9",
      sound: "default",
    }),
    Notifications.setNotificationChannelAsync(APPOINTMENT_CHANNEL_ID, {
      name: "Appointments",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#F59E0B",
      sound: "default",
    }),
  ]);
};

const hasGrantedNotificationPermission = (
  permissions: unknown,
): boolean => {
  const candidate = permissions as {
    granted?: boolean;
    status?: string;
    ios?: { status?: number };
  };

  if (typeof candidate.granted === "boolean") {
    return candidate.granted;
  }

  if (typeof candidate.status === "string") {
    return candidate.status === "granted";
  }

  return candidate.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
};

const resolveProjectId = (): string | null => {
  const easProjectId =
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId ||
    publicEnv.EXPO_PUBLIC_EAS_PROJECT_ID;

  if (!easProjectId || easProjectId === "your-project-id") {
    return null;
  }

  return easProjectId;
};

export const ensureNotificationPermissionsAsync = async (): Promise<boolean> => {
  if (!isNativePlatform) {
    return false;
  }

  await configureNotificationChannelsAsync();

  const existingPermissions = await Notifications.getPermissionsAsync();
  let isGranted = hasGrantedNotificationPermission(existingPermissions);

  if (!isGranted) {
    const permissionResponse = await Notifications.requestPermissionsAsync();
    isGranted = hasGrantedNotificationPermission(permissionResponse);
  }

  if (!isGranted) {
    return false;
  }

  return true;
};

const parseStoredDateTime = (date: string, time: string): Date | null => {
  const day = parseLocalDate(date.split("T")[0]);
  const [hoursText, minutesText] = time.split(":");
  const hours = Number.parseInt(hoursText ?? "", 10);
  const minutes = Number.parseInt(minutesText ?? "", 10);

  if (
    Number.isNaN(day.getTime()) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  day.setHours(hours, minutes, 0, 0);
  return day;
};

const buildBookingFingerprint = (booking: BookingWithDetails): string =>
  [
    booking.status,
    booking.date,
    booking.start_time,
    booking.end_time,
    booking.service_name,
    booking.provider_name ?? "",
    booking.customer_name ?? "",
  ].join("|");

const getBookingCounterparty = (booking: BookingWithDetails): string | null =>
  booking.provider_name ?? booking.customer_name ?? null;

const buildReminderBody = (
  booking: BookingWithDetails,
  leadText: string,
): string => {
  const counterparty = getBookingCounterparty(booking);
  const appointmentLabel = counterparty
    ? `${booking.service_name} with ${counterparty}`
    : booking.service_name;

  return `${appointmentLabel} ${leadText} at ${formatStoredTimeRange(
    booking.start_time,
    booking.end_time,
  )}.`;
};

const loadStoredBookingReminders = async (): Promise<ScheduledBookingReminderMap> => {
  const rawValue = await AsyncStorage.getItem(BOOKING_REMINDER_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as ScheduledBookingReminderMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    await AsyncStorage.removeItem(BOOKING_REMINDER_STORAGE_KEY);
    return {};
  }
};

const cancelScheduledNotificationIds = async (
  notificationIds: string[],
): Promise<void> => {
  await Promise.all(
    notificationIds.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(
        (error) => {
          console.warn(
            "[Notifications] Failed to cancel scheduled notification:",
            identifier,
            error,
          );
        },
      ),
    ),
  );
};

const scheduleAppointmentReminder = async (
  booking: BookingWithDetails,
  reminderType: ReminderType,
  triggerDate: Date,
): Promise<string> => {
  const content =
    reminderType === "day_before"
      ? {
          title: "Appointment tomorrow",
          body: buildReminderBody(booking, "is tomorrow"),
        }
      : {
          title: "Appointment in 2 hours",
          body: buildReminderBody(booking, "starts in 2 hours"),
        };

  return Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      sound: "default",
      data: {
        type: "booking_reminder",
        bookingId: booking.booking_id,
        reminderType,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: APPOINTMENT_CHANNEL_ID,
    },
  });
};

const getReminderTriggers = (
  booking: BookingWithDetails,
  now: Date,
): Array<{ reminderType: ReminderType; triggerDate: Date }> => {
  if (booking.status !== "confirmed") {
    return [];
  }

  const appointmentStart = parseStoredDateTime(booking.date, booking.start_time);
  if (!appointmentStart || appointmentStart.getTime() <= now.getTime()) {
    return [];
  }

  const reminderTriggers: Array<{
    reminderType: ReminderType;
    triggerDate: Date;
  }> = [];
  const tomorrowReminder = new Date(
    appointmentStart.getTime() - REMINDER_DAY_IN_MS,
  );
  const twoHourReminder = new Date(
    appointmentStart.getTime() - REMINDER_TWO_HOURS_IN_MS,
  );

  if (tomorrowReminder.getTime() > now.getTime()) {
    reminderTriggers.push({
      reminderType: "day_before",
      triggerDate: tomorrowReminder,
    });
  }

  if (twoHourReminder.getTime() > now.getTime()) {
    reminderTriggers.push({
      reminderType: "two_hours_before",
      triggerDate: twoHourReminder,
    });
  }

  return reminderTriggers;
};

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  const hasPermission = await ensureNotificationPermissionsAsync();
  if (!hasPermission) {
    return null;
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn(
      "[Notifications] Missing Expo project ID. Set EXPO_PUBLIC_EAS_PROJECT_ID or expo.extra.eas.projectId.",
    );
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResponse.data;
};

export const syncDevicePushToken = async (): Promise<string | null> => {
  const pushToken = await registerForPushNotificationsAsync();
  if (!pushToken) {
    return null;
  }

  const lastStoredToken = await AsyncStorage.getItem(DEVICE_PUSH_TOKEN_STORAGE_KEY);
  if (lastStoredToken === pushToken) {
    return pushToken;
  }

  await registerPushToken(pushToken);
  await AsyncStorage.setItem(DEVICE_PUSH_TOKEN_STORAGE_KEY, pushToken);
  return pushToken;
};

export const clearDevicePushToken = async (): Promise<void> => {
  const storedToken = await AsyncStorage.getItem(DEVICE_PUSH_TOKEN_STORAGE_KEY);
  if (!storedToken) {
    return;
  }

  try {
    await unregisterPushToken(storedToken);
  } finally {
    await AsyncStorage.removeItem(DEVICE_PUSH_TOKEN_STORAGE_KEY);
  }
};

export const syncScheduledBookingReminders = async (
  bookings: BookingWithDetails[],
): Promise<void> => {
  if (!isNativePlatform) {
    return;
  }

  const hasPermission = await ensureNotificationPermissionsAsync();
  if (!hasPermission) {
    return;
  }

  const now = new Date();
  const storedReminders = await loadStoredBookingReminders();
  const nextReminders: ScheduledBookingReminderMap = {};
  const processedBookingIds = new Set<string>();

  for (const booking of bookings) {
    processedBookingIds.add(booking.booking_id);

    const reminderTriggers = getReminderTriggers(booking, now);
    const existingRecord = storedReminders[booking.booking_id];

    if (reminderTriggers.length === 0) {
      if (existingRecord) {
        await cancelScheduledNotificationIds(existingRecord.notificationIds);
      }
      continue;
    }

    const fingerprint = buildBookingFingerprint(booking);
    if (existingRecord?.fingerprint === fingerprint) {
      nextReminders[booking.booking_id] = existingRecord;
      continue;
    }

    if (existingRecord) {
      await cancelScheduledNotificationIds(existingRecord.notificationIds);
    }

    const notificationIds: string[] = [];
    for (const reminder of reminderTriggers) {
      notificationIds.push(
        await scheduleAppointmentReminder(
          booking,
          reminder.reminderType,
          reminder.triggerDate,
        ),
      );
    }

    if (notificationIds.length > 0) {
      nextReminders[booking.booking_id] = {
        fingerprint,
        notificationIds,
      };
    }
  }

  for (const [bookingId, reminderRecord] of Object.entries(storedReminders)) {
    if (!processedBookingIds.has(bookingId) && !nextReminders[bookingId]) {
      await cancelScheduledNotificationIds(reminderRecord.notificationIds);
    }
  }

  await AsyncStorage.setItem(
    BOOKING_REMINDER_STORAGE_KEY,
    JSON.stringify(nextReminders),
  );
};

export const clearScheduledBookingReminders = async (): Promise<void> => {
  const storedReminders = await loadStoredBookingReminders();

  for (const reminderRecord of Object.values(storedReminders)) {
    await cancelScheduledNotificationIds(reminderRecord.notificationIds);
  }

  await AsyncStorage.removeItem(BOOKING_REMINDER_STORAGE_KEY);
};

export const getConversationRouteFromNotification = (
  data: unknown,
): string | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as {
    type?: string;
    conversationId?: string;
    recipientRole?: string;
  };

  if (payload.type !== "chat_message" || !payload.conversationId) {
    return null;
  }

  if (payload.recipientRole === "Provider") {
    return `/(provider)/messages/${payload.conversationId}`;
  }

  return `/(customer)/messages/${payload.conversationId}`;
};

export const shouldRefreshBookingRemindersFromNotification = (
  data: unknown,
): boolean => {
  if (!data || typeof data !== "object") {
    return false;
  }

  const payload = data as { type?: string };
  return payload.type === "booking_rescheduled";
};

export const __testables = {
  buildBookingFingerprint,
  getReminderTriggers,
  parseStoredDateTime,
};
