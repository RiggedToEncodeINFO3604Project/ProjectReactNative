import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useEffect } from "react";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import {
  ThemeProvider as CustomThemeProvider,
  useTheme,
} from "@/context/ThemeContext";

// Component to handle auth-based routing
function AuthNavigator() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const { isDarkMode, setUserType } = useTheme();
  const segments = useSegments();

  // Set userType based on role
  useEffect(() => {
    if (isAuthenticated && role === "Provider") {
      setUserType("provider");
    } else if (isAuthenticated && role === "Customer") {
      setUserType("customer");
    }
  }, [isAuthenticated, role, setUserType]);

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
          backgroundColor: isDarkMode ? "#151718" : "#ffffff",
        }}
      >
        <ActivityIndicator size="large" color="#f0c85a" />
      </View>
    );
  }

  // Determine top level group currently in - seems to have fixed the unmounting before loading
  const inAuthGroup = segments[0] === "(auth)";
  const inCustomerGroup = segments[0] === "(customer)";
  const inProviderGroup = segments[0] === "(provider)";
  
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

      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <CustomThemeProvider>
      <AuthProvider>
        <AuthNavigator />
      </AuthProvider>
    </CustomThemeProvider>
  );
}
