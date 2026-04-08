import fs from "fs";
import path from "path";

type PublicEnv = {
  EXPO_PUBLIC_API_URL: string;
  EXPO_PUBLIC_FIREBASE_API_KEY: string;
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: string;
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  EXPO_PUBLIC_FIREBASE_APP_ID: string;
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: string;
  EXPO_PUBLIC_EAS_PROJECT_ID: string;
};

const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");

const parseDotEnv = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  }

  return parsed;
};

const rootEnv = parseDotEnv(rootEnvPath);

const readEnv = (key: keyof PublicEnv): string =>
  String(process.env[key] ?? rootEnv[key] ?? "").trim();

const publicEnv: PublicEnv = {
  EXPO_PUBLIC_API_URL: readEnv("EXPO_PUBLIC_API_URL"),
  EXPO_PUBLIC_FIREBASE_API_KEY: readEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: readEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
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

export default {
  expo: {
    name: "Skedulelt",
    slug: "skedulelt",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "skedulelt",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-notifications",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: false,
      reactCompiler: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: publicEnv.EXPO_PUBLIC_EAS_PROJECT_ID || "your-project-id",
      },
      publicEnv,
    },
  },
};
