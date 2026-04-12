import Constants from "expo-constants";
import { Platform } from "react-native";

import { publicEnv } from "@/config/publicEnv";

const normalizeUrl = (value?: string | null): string =>
  (value || "").trim().replace(/\/+$/, "");

const extractPort = (value: string, fallbackPort: string): string => {
  const match = value.match(/:(\d+)(?:\/|$)/);
  return match?.[1] || fallbackPort;
};

const isPrivateOrLocalHost = (hostname: string): boolean => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
};

const extractExpoHost = (): string | null => {
  const expoConfigHost = (Constants.expoConfig as { hostUri?: string } | null)
    ?.hostUri;
  if (expoConfigHost) {
    return expoConfigHost;
  }

  const manifest2Host = (
    Constants as typeof Constants & {
      manifest2?: {
        extra?: {
          expoGo?: {
            debuggerHost?: string;
          };
        };
      };
    }
  ).manifest2?.extra?.expoGo?.debuggerHost;

  return manifest2Host || null;
};

const rewriteLocalhostToExpoHost = (url: string): string => {
  if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
    return url;
  }

  const expoHostname = extractExpoHost()?.split(":")[0];
  if (!expoHostname) {
    return url;
  }

  return url.replace(/(localhost|127\.0\.0\.1)/, expoHostname);
};

const resolveBaseUrl = (
  configuredValue: string,
  fallbackPort: string,
): string => {
  const configuredUrl = normalizeUrl(configuredValue);
  const isLocalhostConfig =
    !configuredUrl ||
    configuredUrl.includes("localhost") ||
    configuredUrl.includes("127.0.0.1");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (!isLocalhostConfig) {
      return configuredUrl;
    }

    const currentHostname = window.location.hostname;
    if (isPrivateOrLocalHost(currentHostname)) {
      const configuredPort = extractPort(configuredUrl, fallbackPort);
      return `${window.location.protocol}//${currentHostname}:${configuredPort}`;
    }

    return configuredUrl || `${window.location.protocol}//localhost:${fallbackPort}`;
  }

  if (!isLocalhostConfig) {
    return configuredUrl;
  }

  if (Platform.OS === "android" && configuredUrl.includes("10.0.2.2")) {
    return configuredUrl;
  }

  const fallbackUrl = configuredUrl || `http://localhost:${fallbackPort}`;
  return rewriteLocalhostToExpoHost(fallbackUrl);
};

const legacyApiUrl = normalizeUrl(publicEnv.EXPO_PUBLIC_API_URL);

export const getSchedulingServiceBaseUrl = (): string =>
  resolveBaseUrl(
    publicEnv.EXPO_PUBLIC_SCHEDULING_URL || legacyApiUrl,
    "8000",
  );

export const getMessagingServiceBaseUrl = (): string =>
  resolveBaseUrl(
    publicEnv.EXPO_PUBLIC_MESSAGING_URL || legacyApiUrl,
    "8002",
  );

export const getSnapshotServiceBaseUrl = (): string =>
  resolveBaseUrl(
    publicEnv.EXPO_PUBLIC_SNAPSHOT_URL || legacyApiUrl,
    "8003",
  );

export const getRagServiceBaseUrl = (): string =>
  resolveBaseUrl(
    publicEnv.EXPO_PUBLIC_RAG_URL || legacyApiUrl,
    "8001",
  );

export const getRagChatUrl = (): string =>
  `${getRagServiceBaseUrl()}/api/chat`;

export const getRagHealthUrl = (): string => {
  const hasDedicatedRagUrl = Boolean(normalizeUrl(publicEnv.EXPO_PUBLIC_RAG_URL));
  if (!hasDedicatedRagUrl && legacyApiUrl) {
    return `${getRagServiceBaseUrl()}/api/rag/health`;
  }

  return `${getRagServiceBaseUrl()}/api/health`;
};

export const getMessagingWebSocketUrl = (): string => {
  const baseUrl = getMessagingServiceBaseUrl();

  if (baseUrl.startsWith("https://")) {
    return `${baseUrl.replace("https://", "wss://")}/ws`;
  }

  if (baseUrl.startsWith("http://")) {
    return `${baseUrl.replace("http://", "ws://")}/ws`;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${baseUrl}/ws`;
  }

  return `wss://${baseUrl}/ws`;
};
