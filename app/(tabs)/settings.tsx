import { useTheme } from "@/context/ThemeContext";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

export default function SettingsScreen() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <SafeAreaView
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
          Settings
        </Text>

        <View style={styles.settingItem}>
          <Text
            style={[
              styles.settingLabel,
              isDarkMode ? styles.darkText : styles.lightText,
            ]}
          >
            Dark Mode
          </Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isDarkMode ? "#f5dd4b" : "#f4f3f4"}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lightContainer: {
    backgroundColor: "#fff",
  },
  darkContainer: {
    backgroundColor: "#151718",
  },
  content: {
    width: "80%",
    alignItems: "center",
    gap: 24,
  },
  title: {
    fontFamily: "serif",
    fontSize: 32,
    fontWeight: "400",
    marginBottom: 20,
  },
  lightText: {
    color: "#11181C",
  },
  darkText: {
    color: "#ECEDEE",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  settingLabel: {
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "400",
  },
});
