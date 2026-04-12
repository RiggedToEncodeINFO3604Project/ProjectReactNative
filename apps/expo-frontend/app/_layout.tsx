import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { getScreenPalette } from "@/constants/theme";
import {
  ThemeProvider as CustomThemeProvider,
  useTheme,
} from "@/context/ThemeContext";
import {
  getConversationRouteFromNotification,
  syncDevicePushToken,
} from "@/services/notifications";

// Component to handle auth-based routing
function AuthNavigator() {
  const { isAuthenticated, role, isLoading, user } = useAuth();
  const { isDarkMode, setUserType } = useTheme();
  const screenPalette = getScreenPalette(isDarkMode);
  const segments = useSegments();
  const router = useRouter();
  const handledNotificationId = useRef<string | null>(null);

  // Set userType based on role
  useEffect(() => {
    if (isAuthenticated && role === "Provider") {
      setUserType("provider");
    } else if (isAuthenticated && role === "Customer") {
      setUserType("customer");
    }
  }, [isAuthenticated, role, setUserType]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    syncDevicePushToken().catch((error) => {
      console.error("Error syncing push token:", error);
    });
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const navigateFromNotification = (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response) {
        return;
      }

      const notificationId = response.notification.request.identifier;
      if (handledNotificationId.current === notificationId) {
        return;
      }

      const route = getConversationRouteFromNotification(
        response.notification.request.content.data,
      );
      if (!route) {
        return;
      }

      handledNotificationId.current = notificationId;
      router.push(route as never);
    };

    Notifications.getLastNotificationResponseAsync()
      .then(navigateFromNotification)
      .catch((error) => {
        console.error("Error reading last notification response:", error);
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      navigateFromNotification,
    );

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, router]);

  console.log(
    "AuthNavigator - isAuthenticated:",
    isAuthenticated,
    "role:",
    role,
    "isLoading:",
    isLoading,
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: screenPalette.background,
        }}
      >
        <ActivityIndicator size="large" color={screenPalette.accent} />
      </View>
    );
  }

  // Determine top level group currently in - seems to have fixed the unmounting before loading
  const inAuthGroup = segments[0] === "(auth)";
  // Check if currently on settings screen (accessible without auth)
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : "";
  const isSettingsRoute = currentRoute === "settings";

  return (
    <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Auth screens */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        {/* Customer screens */}
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />

        {/* Provider screens */}
        <Stack.Screen name="(provider)" options={{ headerShown: false }} />

        {/* Shared screens — available to all roles */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="support"
          options={{ presentation: "modal", title: "Home" }}
        />
      </Stack>

      {/* Redirect unauthenticated users to login if they aren't in an auth group and not on settings */}
      {!isAuthenticated && !inAuthGroup && !isSettingsRoute && <Redirect href="/login" />}

      {/* Redirect authenticated users to their home screen if they're still in the auth group */}
      {isAuthenticated && inAuthGroup && role === "Customer" && (
        <Redirect href="/(customer)" />
      )}
      {isAuthenticated && inAuthGroup && role === "Provider" && (
        <Redirect href="/(provider)" />
      )}

      <StatusBar style={isDarkMode ? "light" : "dark"} backgroundColor="transparent" translucent={true} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CustomThemeProvider>
        <AuthProvider>
          <AuthNavigator />
        </AuthProvider>
      </CustomThemeProvider>
    </SafeAreaProvider>
  );
}
