import BackButton from "@/components/BackButton";
import { ExtendedColours, SharedColours, UIColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { router } from "expo-router";
import { StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.cardAlt,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: isDarkMode
      ? SharedColours.bookingStatus.pending
      : extendedColours.text,
  };

  const handleBackPress = () => {
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colours.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colours.card,
            borderBottomColor: colours.border,
            paddingTop: 20,
          },
        ]}
      >
        <BackButton onPress={handleBackPress} style={styles.backButton} />
        <Text style={[styles.title, { color: colours.text }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Settings Content */}
      <View style={styles.content}>
        <View
          style={[
            styles.settingItem,
            { backgroundColor: colours.card, borderColor: colours.border },
          ]}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colours.text }]}>
              Dark Mode
            </Text>
            <Text
              style={[styles.settingDescription, { color: colours.textMuted }]}
            >
              {isDarkMode
                ? "Currently using dark theme"
                : "Currently using light theme"}
            </Text>
          </View>
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

        {/* App Info Section */}
        <View style={styles.infoSection}>
          <Text style={[styles.appName, { color: colours.accent }]}>
            SkeduleIt
          </Text>
          <Text style={[styles.versionText, { color: colours.textMuted }]}>
            Version 1.0.0
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  infoSection: {
    alignItems: "center",
    marginTop: "auto",
    paddingBottom: 40,
  },
  appName: {
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "400",
    marginBottom: 8,
  },
  versionText: {
    fontSize: 14,
  },
});
