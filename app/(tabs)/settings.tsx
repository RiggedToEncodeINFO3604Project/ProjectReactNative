import { UIColours, getScreenPalette } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { StatusBar, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const colours = getScreenPalette(isDarkMode, { cardTone: "alt" });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colours.background }]}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <View style={styles.content}>
        <Text style={[styles.title, { color: colours.text }]}>
          Settings
        </Text>

        <View
          style={[
            styles.settingItem,
            {
              backgroundColor: colours.card,
              borderColor: colours.border,
            },
          ]}
        >
          <Text style={[styles.settingLabel, { color: colours.text }]}>
            Dark Mode
          </Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{
              false: UIColours.switch.trackFalse,
              true: UIColours.switch.trackTrue,
            }}
            thumbColor={
              isDarkMode
                ? UIColours.switch.thumbTrueDark
                : UIColours.switch.thumbFalse
            }
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
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingLabel: {
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "400",
  },
});
