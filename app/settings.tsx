import BackButton from "@/components/BackButton";
import { ExtendedColors, SharedColors, UIColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { router } from "expo-router";
import { StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  const extendedColors = ExtendedColors[isDarkMode ? "dark" : "light"];

  const colors = {
    background: extendedColors.background,
    card: extendedColors.cardAlt,
    text: extendedColors.text,
    textMuted: extendedColors.textMuted,
    border: extendedColors.border,
    accent: isDarkMode
      ? SharedColors.bookingStatus.pending
      : extendedColors.text,
  };

  const handleBackPress = () => {
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: 20,
          },
        ]}
      >
        <BackButton onPress={handleBackPress} style={styles.backButton} />
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Settings Content */}
      <View style={styles.content}>
        <View
          style={[
            styles.settingItem,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Dark Mode
            </Text>
            <Text
              style={[styles.settingDescription, { color: colors.textMuted }]}
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
              false: UIColors.switch.trackFalse,
              true: UIColors.switch.trackTrue,
            }}
            thumbColor={
              isDarkMode
                ? UIColors.switch.thumbTrueDark
                : UIColors.switch.thumbFalse
            }
          />
        </View>

        {/* App Info Section */}
        <View style={styles.infoSection}>
          <Text style={[styles.appName, { color: colors.accent }]}>
            SkeduleIt
          </Text>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
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
