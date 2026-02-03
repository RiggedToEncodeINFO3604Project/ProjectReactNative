import { Link } from "expo-router";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";

export default function HomeScreen() {
  const { isDarkMode } = useTheme();

  return (
    <View
      style={[
        styles.container,
        isDarkMode ? styles.darkContainer : styles.lightContainer,
      ]}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            isDarkMode ? styles.darkText : styles.lightText,
          ]}
        >
          welcome to
        </Text>
        <Text style={styles.brandName}>SkeduleIt</Text>

        <Link href="/support" asChild>
          <TouchableOpacity style={styles.button} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Support Assistant</Text>
          </TouchableOpacity>
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
  lightContainer: {
    backgroundColor: "#fff",
  },
  darkContainer: {
    backgroundColor: "#151718",
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
  lightText: {
    color: "#11181C",
  },
  darkText: {
    color: "#ECEDEE",
  },
  brandName: {
    fontFamily: "serif",
    fontSize: 56,
    fontWeight: "400",
    color: "#f0c85a",
    textShadowColor: "#f0c85a",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 60,
    letterSpacing: -1,
  },
  button: {
    backgroundColor: "#f0c85a",
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 200,
    alignItems: "center",
    shadowColor: "#f0c85a",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "400",
    color: "#0c0e12",
    letterSpacing: 1,
  },
});
