import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

export default function AuthLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDarkMode ? "#151718" : "#ffffff",
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register/index" />
      <Stack.Screen name="register/customer" />
      <Stack.Screen name="register/provider" />
    </Stack>
  );
}
