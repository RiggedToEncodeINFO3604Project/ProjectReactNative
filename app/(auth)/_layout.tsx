import { getScreenPalette } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

export default function AuthLayout() {
  const { isDarkMode } = useTheme();
  const screenPalette = getScreenPalette(isDarkMode);

  return (
    <Stack
      initialRouteName="login"
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: screenPalette.background,
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
