import { Link } from "expo-router";
import { Platform, StatusBar, StyleSheet, Text, View } from "react-native";

import { getScreenPalette } from "@/constants/theme";
import AnimatedButton from "@/components/ui/animated-button";
import { useTheme } from "@/context/ThemeContext";

export default function HomeScreen() {
  const { isDarkMode } = useTheme();
  const colours = getScreenPalette(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <View style={styles.content}>
        <Text style={[styles.title, { color: colours.text }]}>
          welcome to
        </Text>
        <Text
          style={[
            styles.brandName,
            { color: colours.accent, textShadowColor: colours.accent },
          ]}
        >
          SkeduleIt
        </Text>

        <Link href="/support" asChild>
          <AnimatedButton title="Support Assistant" />
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 80 : 60,
  },
  content: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "400",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brandName: {
    fontFamily: "serif",
    fontSize: 56,
    fontWeight: "400",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 60,
    letterSpacing: -1,
  },
});
