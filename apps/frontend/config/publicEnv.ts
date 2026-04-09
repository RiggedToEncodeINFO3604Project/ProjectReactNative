import Constants from "expo-constants";
import { Platform } from "react-native";

type PublicEnvShape = {
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_FIREBASE_API_KEY?: string;
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  EXPO_PUBLIC_FIREBASE_APP_ID?: string;
  EXPO_PUBLIC_FIREBASE_DATABASE_URL?: string;
  EXPO_PUBLIC_EAS_PROJECT_ID?: string;
};

type WebRuntimeWindow = Window & {
  __PUBLIC_ENV__?: Partial<PublicEnvShape>;
};

const expoExtra = (Constants.expoConfig?.extra as {
  publicEnv?: PublicEnvShape;
} | null)?.publicEnv;

const webRuntimeEnv =
  Platform.OS === "web"
    ? (globalThis.window as WebRuntimeWindow | undefined)?.__PUBLIC_ENV__ ?? null
    : null;

const readEnv = (key: keyof PublicEnvShape): string => {
  const value = webRuntimeEnv?.[key] ?? process.env[key] ?? expoExtra?.[key] ?? "";
  return value.trim();
};

export const publicEnv: Required<PublicEnvShape> = {
  EXPO_PUBLIC_API_URL: readEnv("EXPO_PUBLIC_API_URL"),
  EXPO_PUBLIC_FIREBASE_API_KEY: readEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: readEnv(
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  ),
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: readEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: readEnv(
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  ),
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: readEnv(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ),
  EXPO_PUBLIC_FIREBASE_APP_ID: readEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: readEnv(
    "EXPO_PUBLIC_FIREBASE_DATABASE_URL",
  ),
  EXPO_PUBLIC_EAS_PROJECT_ID: readEnv("EXPO_PUBLIC_EAS_PROJECT_ID"),
};
