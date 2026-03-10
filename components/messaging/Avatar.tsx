// =====================================================
// = Avatar Component                                  =
// = Reusable avatar with image or initials fallback   =
// =====================================================

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Image, StyleSheet, Text, View } from "react-native";

interface AvatarProps {
  uri?: string;
  name: string;
  size?: "small" | "medium" | "large";
  online?: boolean;
}

const SIZE_MAP = {
  small: 40,
  medium: 50,
  large: 60,
};

const FONT_SIZE_MAP = {
  small: 14,
  medium: 18,
  large: 22,
};

const ONLINE_INDICATOR_SIZE = {
  small: 10,
  medium: 12,
  large: 14,
};

export function Avatar({
  uri,
  name,
  size = "medium",
  online = false,
}: AvatarProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const dimension = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const onlineSize = ONLINE_INDICATOR_SIZE[size];

  // Get initials from name (up to 2 characters)
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Generate a consistent color based on name
  const getBackgroundColor = (name: string): string => {
    const colors = [
      "#0a7ea4", // Primary
      "#687076", // Gray
      "#f0c85a", // Accent yellow
      "#28a745", // Success green
      "#dc3545", // Error red
      "#6f42c1", // Purple
      "#fd7e14", // Orange
      "#20c997", // Teal
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <View style={[styles.container, { width: dimension, height: dimension }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: theme.icon,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: getBackgroundColor(name),
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: "#fff" }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      {online && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: onlineSize,
              height: onlineSize,
              borderRadius: onlineSize / 2,
              bottom: size === "small" ? 1 : 2,
              right: size === "small" ? 1 : 2,
              backgroundColor: "#28a745",
              borderColor: theme.background,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  image: {
    // backgroundColor set dynamically
  },
  initialsContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontWeight: "600",
  },
  onlineIndicator: {
    position: "absolute",
    borderWidth: 2,
  },
});

export default Avatar;
