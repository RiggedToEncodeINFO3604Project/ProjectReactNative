/**
 * Custom hook to get theme colors based on user type and dark mode.
 * This hook uses the ThemeContext to get the appropriate colors.
 */

import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the appropriate color based on the current theme context.
 * This automatically handles provider/customer and light/dark mode switching.
 *
 * @param colorName - The name of the color to get from the theme
 * @returns The color value as a string
 */
export function useThemeColor<
  K extends keyof ReturnType<typeof useTheme>["colors"],
>(colorName: K): ReturnType<typeof useTheme>["colors"][K] {
  const { colors } = useTheme();
  return colors[colorName];
}

/**
 * Alternative hook that accepts props for custom color overrides.
 * Useful when you need a specific color that might differ from the theme.
 *
 * @param props - Object with optional light and dark color overrides
 * @param colorName - The fallback color name from the theme
 * @returns The color value, preferring props over theme colors
 */
export function useThemeColorWithFallback(
  props: { light?: string; dark?: string },
  colorName: keyof ReturnType<typeof useTheme>["colors"],
) {
  const { colors, isDarkMode } = useTheme();

  // If props are provided, use them based on current theme
  if (props[isDarkMode ? "dark" : "light"]) {
    return props[isDarkMode ? "dark" : "light"];
  }

  // Otherwise, use the theme color
  return colors[colorName];
}

export { useTheme } from "@/context/ThemeContext";

