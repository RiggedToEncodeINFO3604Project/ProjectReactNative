/**
 * Custom hook to get theme colours based on user type and dark mode.
 * This hook uses the ThemeContext to get the appropriate colours.
 */

import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the appropriate color based on the current theme context.
 * This automatically handles provider/customer and light/dark mode switching.
 *
 * @param colourName - The name of the color to get from the theme
 * @returns The color value as a string
 */
export function useThemeColour<
  K extends keyof ReturnType<typeof useTheme>["colours"],
>(colourName: K): ReturnType<typeof useTheme>["colours"][K] {
  const { colours } = useTheme();
  return colours[colourName];
}

/**
 * Alternative hook that accepts props for custom color overrides.
 * Useful when you need a specific color that might differ from the theme.
 *
 * @param props - Object with optional light and dark color overrides
 * @param colourName - The fallback color name from the theme
 * @returns The color value, preferring props over theme colours
 */
export function useThemeColourWithFallback(
  props: { light?: string; dark?: string },
  colourName: keyof ReturnType<typeof useTheme>["colours"],
) {
  const { colours, isDarkMode } = useTheme();

  // If props are provided, use them based on current theme
  if (props[isDarkMode ? "dark" : "light"]) {
    return props[isDarkMode ? "dark" : "light"];
  }

  // Otherwise, use the theme colour
  return colours[colourName];
}

export { useTheme } from "@/context/ThemeContext";

