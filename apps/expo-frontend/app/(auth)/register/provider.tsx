import BackButton from "@/components/BackButton";
import { getScreenPalette } from "@/constants/theme";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterProviderScreen() {
  const { isDarkMode } = useTheme();
  const { registerProvider, login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [providerName, setProviderName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [providerAddress, setProviderAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (
      !providerName ||
      !businessName ||
      !email ||
      !bio ||
      !providerAddress ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Register the provider
      await registerProvider(
        { email, password, role: "Provider" },
        { providerName, businessName, bio, providerAddress, isActive: true },
      );

      // Automatically log in the user
      await login(email, password);

      // Navigation will be handled by AuthContext state change
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const colours = getScreenPalette(isDarkMode, { cardTone: "alt" });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colours.background }]}
    >
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
              paddingTop: Math.max(insets.top, 24) + 16,
              paddingLeft: 20 + insets.left,
              paddingRight: 20 + insets.right,
            },
          ]}
        >
          <Text style={[styles.title, { color: colours.text }]}>
            Register as Provider
          </Text>
          <Text style={[styles.subtitle, { color: colours.textMuted }]}>
            Create your provider account to offer services
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
              placeholder="Provider Name (Your Name)"
              placeholderTextColor={colours.textMuted}
              value={providerName}
              onChangeText={setProviderName}
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
              placeholder="Business Name"
              placeholderTextColor={colours.textMuted}
              value={businessName}
              onChangeText={setBusinessName}
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
                styles.textArea,
                {
                  backgroundColor: colours.inputBg,
                  color: colours.text,
                  borderColor: colours.border,
                },
              ]}
              placeholder="Bio / Description"
              placeholderTextColor={colours.textMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
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
              placeholder="Provider Address"
              placeholderTextColor={colours.textMuted}
              value={providerAddress}
              onChangeText={setProviderAddress}
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

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colours.inputBg,
                  color: colours.text,
                  borderColor: colours.border,
                },
              ]}
              placeholder="Confirm Password"
              placeholderTextColor={colours.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colours.accent }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colours.accentContrast} />
              ) : (
                <Text
                  style={[styles.buttonText, { color: colours.accentContrast }]}
                >
                  Register
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <BackButton onPress={() => router.back()} style={styles.backLink} />
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
  },
  content: {
    alignItems: "center",
  },
  title: {
    fontFamily: "serif",
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
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
  backLink: {
    marginTop: 24,
  },
});
