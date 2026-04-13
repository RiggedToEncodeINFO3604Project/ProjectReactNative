import {
  getMessagingServiceBaseUrl,
  getRagHealthUrl,
  getSchedulingServiceBaseUrl,
  getSnapshotServiceBaseUrl,
} from "@/config/serviceUrls";
import { getScreenPalette } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { isDarkMode } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const serverButtons = [
    {
      label: "Start Core Scheduling Server",
      url: `${getSchedulingServiceBaseUrl()}/health`,
    },
    {
      label: "Start Messaging Server",
      url: `${getMessagingServiceBaseUrl()}/health`,
    },
    {
      label: "Start Snapshot Server",
      url: `${getSnapshotServiceBaseUrl()}/health`,
    },
    {
      label: "Start RAG Server",
      url: getRagHealthUrl(),
    },
  ];

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      console.log("Attempting login with:", email);
      const response = await login(email, password);
      console.log("Login response:", response);
      // Navigation is handled automatically by AuthNavigator in _layout.tsx
      // based on isAuthenticated and role state changes
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || error.message || "Login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenServer = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Cannot open this URL");
    }
  };

  const colours = getScreenPalette(isDarkMode, { cardTone: "alt" });

  const handleSettingsPress = () => {
    router.push("/settings");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colours.background }]}
    >
      {/* Settings Button */}
      <TouchableOpacity
        style={[styles.settingsButton, { top: insets.top + 10, right: 16 }]}
        onPress={handleSettingsPress}
        accessibilityLabel="Settings"
        accessibilityRole="button"
      >
        <IconSymbol name="gearshape.fill" size={28} color={colours.accent} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 24),
              paddingLeft: 20 + insets.left,
              paddingRight: 20 + insets.right,
            },
          ]}
        >
          <Text style={[styles.brandName, { color: colours.accent }]}>
            SkeduleIt
          </Text>
          <Text style={[styles.subtitle, { color: colours.textMuted }]}>
            Sign in to your account
          </Text>

          <View
            style={[
              styles.form,
              { backgroundColor: colours.card, borderColor: colours.border },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colours.inputBg,
                  color: colours.text,
                  borderColor: colours.border,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={colours.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colours.inputBg,
                  color: colours.text,
                  borderColor: colours.border,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={colours.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colours.accent }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colours.accentContrast} />
              ) : (
                <Text
                  style={[styles.buttonText, { color: colours.accentContrast }]}
                >
                  Login
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, { color: colours.textMuted }]}>
                Don&apos;t have an account?
              </Text>
              <TouchableOpacity
                onPress={() => router.push("register" as never)}
              >
                <Text style={[styles.registerLink, { color: colours.accent }]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.serverNotice}>
              Please ensure all servers are spun up before attempting to login.
            </Text>

            <View style={styles.serverButtonsContainer}>
              {serverButtons.map((serverButton) => (
                <TouchableOpacity
                  key={serverButton.label}
                  style={[
                    styles.serverButton,
                    {
                      backgroundColor: colours.inputBg,
                      borderColor: colours.border,
                    },
                  ]}
                  onPress={() => handleOpenServer(serverButton.url)}
                >
                  <Text
                    style={[
                      styles.serverButtonText,
                      { color: colours.textMuted },
                    ]}
                  >
                    {serverButton.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  settingsButton: {
    position: "absolute",
    zIndex: 10,
    padding: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
  },
  brandName: {
    fontFamily: "serif",
    fontSize: 48,
    fontWeight: "400",
    marginBottom: 8,
    textShadowColor: "#f0c85a",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    gap: 4,
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  serverNotice: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
    textAlign: "center",
  },
  serverButtonsContainer: {
    marginTop: 8,
    width: "100%",
  },
  serverButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 12,
  },
  serverButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
