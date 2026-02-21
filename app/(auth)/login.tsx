import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const { isDarkMode } = useTheme();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

  const colors = {
    background: isDarkMode ? "#151718" : "#ffffff",
    card: isDarkMode ? "#1e2333" : "#f8f9fa",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    inputBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={[styles.brandName, { color: colors.accent }]}>
            SkeduleIt
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Sign in to your account
          </Text>

          <View
            style={[
              styles.form,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#151718" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, { color: colors.textMuted }]}>
                Don't have an account?
              </Text>
              <TouchableOpacity
                onPress={() => router.push("register" as never)}
              >
                <Text style={[styles.registerLink, { color: colors.accent }]}>
                  Register
                </Text>
              </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    padding: 20,
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
    color: "#151718",
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
});
