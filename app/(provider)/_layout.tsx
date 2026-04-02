import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

export default function ProviderLayout() {
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
      <Stack.Screen name="services" />
      <Stack.Screen name="availability" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="confirmed" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="snapshot/[customerId]" />
      <Stack.Screen name="manage-tagging" />
    </Stack>
  );
}
