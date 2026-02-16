import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Redirect, Stack } from "expo-router";
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
  const { isDarkMode } = useTheme();

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

  // If not authenticated, show auth screens with redirect to login
  if (!isAuthenticated) {
    return (
      <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="support"
            options={{ presentation: "modal", title: "Home" }}
          />
        </Stack>
        <Redirect href="/login" />
        <StatusBar style={isDarkMode ? "light" : "dark"} />
      </ThemeProvider>
    );
  }

  // If authenticated as Customer, show customer screens
  if (role === "Customer") {
    return (
      <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(customer)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="support"
            options={{ presentation: "modal", title: "Home" }}
          />
        </Stack>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
      </ThemeProvider>
    );
  }

  // If authenticated as Provider, show provider screens
  if (role === "Provider") {
    return (
      <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(provider)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="support"
            options={{ presentation: "modal", title: "Home" }}
          />
        </Stack>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
      </ThemeProvider>
    );
  }

  // Fallback to auth screens
  return (
    <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="support"
          options={{ presentation: "modal", title: "Home" }}
        />
      </Stack>
      <Redirect href="/login" />
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
