import { getScreenPalette } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

export default function CustomerLayout() {
  const { isDarkMode } = useTheme();
  const screenPalette = getScreenPalette(isDarkMode, { backgroundTone: "alt" });

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: screenPalette.background,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="search" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="provider/[id]" />
    </Stack>
  );
}
