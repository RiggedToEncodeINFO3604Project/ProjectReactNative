import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

export default function CustomerLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDarkMode ? "#151718" : "#f5f5f5",
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="provider/[id]" />
    </Stack>
  );
}
