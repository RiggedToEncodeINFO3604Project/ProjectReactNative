import { registerPushToken, unregisterPushToken } from "@/services/schedulingApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { publicEnv } from "@/config/publicEnv";

const DEVICE_PUSH_TOKEN_STORAGE_KEY = "devicePushToken";

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

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (!isNativePlatform) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0EA5E9",
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const permissionResponse = await Notifications.requestPermissionsAsync();
    finalStatus = permissionResponse.status;
  }

  if (finalStatus !== "granted") {
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
