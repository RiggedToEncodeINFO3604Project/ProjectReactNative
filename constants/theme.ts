/**
 * Centralized theme colours for the app.
 * All colours should be defined here and imported from this file.
 * There are many other ways to style your app. For example,
 * [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/),
 * [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// ============================================================================
// Base tint colours for light and dark mode
// ============================================================================
const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

// ============================================================================
// Shared/Common Colours (used across both provider and customer apps)
// ============================================================================
export const SharedColours = {
  // Semantic colours (same in both light and dark)
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",

  // Status colours
  success: "#34C759",
  error: "#FF3B30",
  errorAlt: "#e10600", // Alternative error red
  warning: "#FF9500",
  warningAlt: "#ffc107", // Warning yellow (for connection status)
  info: "#0a7ea4", // Primary tint color

  // Avatar colours
  avatarColors: [
    "#0a7ea4", // Primary
    "#687076", // Gray
    "#f0c85a", // Accent yellow
    "#28a745", // Success green
    "#dc3545", // Error red
    "#6f42c1", // Purple
    "#fd7e14", // Orange
    "#20c997", // Teal
  ] as const,

  // Chat bubble highlight
  highlight: "#ffeb3b",
  chatBubble: {
    yellow: "#ffeb3b",
  },

  // Calendar specific
  calendar: {
    background: "#f5d06e",
    calendarBackground: "#f5d06e",
    textSectionTitleColor: "#000",
    dayTextColor: "#000",
    todayTextColor: "#8B0000",
    selectedDayBackgroundColor: "#6366F1",
    selectedDayTextColor: "#ffffff",
    arrowColor: "#000",
    monthTextColor: "#000",
    textDisabledColor: "#888",
    dotColor: "#8B0000",
  },

  // Booking status colours
  bookingStatus: {
    confirmed: "#34C759",
    pending: "#f0c85a",
    cancelled: "#FF3B30",
    completed: "#6b7280",
    default: "#6b7280",
  },

  // Availability status colours
  availabilityStatus: {
    fullyBooked: "#FF3B30",
    mostlyBooked: "#f0c85a",
    partiallyBooked: "#34C759",
    available: "#34C759",
  },
};

// ============================================================================
// Extended UI Colours (for components that need more colours than main theme)
// ============================================================================
export const ExtendedColours = {
  light: {
    // Extended background colours
    background: "#ffffff",
    backgroundAlt: "#f5f5f5",
    card: "#f5f5f5",
    cardAlt: "#f8f9fa",

    // Extended text colours
    text: "#11181C",
    textMuted: "#6b7280",
    textSecondary: "#687076",

    // Extended border colours
    border: "#dee2e6",
    borderAlt: "#e9ecef",

    // Extended input colours
    inputBg: "#e9ecef",
    inputBorder: "#dee2e6",

    // Extended status colours
    successBg: "#d4edda",
    errorBg: "#f8d7da",
    warningBg: "#fff3cd",

    // Extended special colours
    selectedBg: "#e3f2fd",
    searchBg: "#f5f5f5",
    searchInputBg: "#f0f0f0",

    // Connection status
    connectionError: "#dc3545",
    connecting: "#ffc107",
  },
  dark: {
    // Extended background colours
    background: "#151718",
    backgroundAlt: "#1a1a1a",
    card: "#1e2333",
    cardAlt: "#1a1f2e",

    // Extended text colours
    text: "#ECEDEE",
    textMuted: "#9BA1A6",
    textSecondary: "#9BA1A6",

    // Extended border colours
    border: "#2a2f3e",
    borderAlt: "#333333",

    // Extended input colours
    inputBg: "#1a1f2e",
    inputBorder: "#2a2f3e",

    // Extended status colours
    successBg: "#1a3a2a",
    errorBg: "#2a1a1a",
    warningBg: "#2a2a1a",

    // Extended special colours
    selectedBg: "#1a3a4a",
    searchBg: "#2a2a2a",
    searchInputBg: "#333333",

    // Connection status
    connectionError: "#dc3545",
    connecting: "#ffc107",
  },
};

// ============================================================================
// Provider (Business) Theme Colours
// ============================================================================
export const ProviderColours = {
  light: {
    primary: "#01d0a8", // Main/Primary - teal/mint for provider
    secondary: "#000000", // Black
    secondaryGray: "#666666", // Gray
    secondaryLight: "#e6e6e6", // Light gray
    alert: "#e10600", // Red
    background: "#ffffff", // White
    text: "#11181C",
    textSecondary: "#687076",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#01d0a8",
    tint: "#01d0a8",
    accent: "#000000", // Black for light mode
  },
  dark: {
    primary: "#f0c85a", // Gold - distinct dark mode primary for customer
    secondary: "#000000", // Black
    secondaryGray: "#666666", // Gray
    secondaryLight: "#e6e6e6", // Light gray
    alert: "#e10600", // Red
    background: "#151718", // Keep existing dark background
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#f0c85a",
    tint: "#f0c85a",
    accent: "#f0c85a", // Gold for dark mode
  },
};

// ============================================================================
// Customer Theme Colours
// ============================================================================
export const CustomerColours = {
  light: {
    primary: "#1e4e8c", // Main/Primary - teal/mint
    secondary: "#000000", // Black
    secondaryGray: "#666666", // Gray
    secondaryLight: "#e6e6e6", // Light gray
    alert: "#e10600", // Red
    background: "#ffffff", // White
    text: "#11181C",
    textSecondary: "#687076",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#1e4e8c",
    tint: "#1e4e8c",
    accent: "#000000", // Black for light mode
  },
  dark: {
    primary: "#f0c85a", // Gold - distinct dark mode primary for customer
    secondary: "#000000", // Black
    secondaryGray: "#666666", // Gray
    secondaryLight: "#e6e6e6", // Light gray
    alert: "#e10600", // Red
    background: "#151718", // Keep existing dark background
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#f0c85a",
    tint: "#f0c85a",
    accent: "#f0c85a", // Gold for dark mode
  },
};

// ============================================================================
// Original Colours (kept for backward compatibility)
// ============================================================================
export const Colours = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

// ============================================================================
// UI Component Colours (Standard colours for buttons, switches, etc.)
// ============================================================================
export const UIColours = {
  // Switch track colours
  switch: {
    trackFalse: "#767577",
    trackTrue: "#81b0ff",
    thumbTrueLight: "#f5dd4b",
    thumbTrueDark: "#f5dd4b",
    thumbFalse: "#f4f3f4",
  },

  // Default button colours
  button: {
    primaryLight: "#f0c85a",
    primaryDark: "#f0c85a",
    textLight: "#0c0e12",
    textDark: "#0c0e12",
  },

  // Shadow color
  shadow: "#000000",

  // Modal overlay
  overlay: "rgba(0, 0, 0, 0.5)",

  // Tab bar
  tabBar: {
    light: "#ffffff",
    dark: "#151718",
  },
};

// ============================================================================
// User Type
// ============================================================================
export type UserType = "provider" | "customer";

// ============================================================================
// Helper function to get colours based on user type and dark mode
// ============================================================================
export function getThemeColours(userType: UserType, isDarkMode: boolean) {
  const theme = isDarkMode ? "dark" : "light";

  if (userType === "provider") {
    return ProviderColours[theme];
  } else {
    return CustomerColours[theme];
  }
}

// ============================================================================
// Helper function to get extended colours based on dark mode
// ============================================================================
export function getExtendedColours(isDarkMode: boolean) {
  return isDarkMode ? ExtendedColours.dark : ExtendedColours.light;
}

// ============================================================================
// Fonts
// ============================================================================
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
