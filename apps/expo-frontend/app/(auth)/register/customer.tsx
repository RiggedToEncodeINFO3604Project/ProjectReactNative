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

export default function RegisterCustomerScreen() {
  const { isDarkMode } = useTheme();
  const { registerCustomer, login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Register the customer
      await registerCustomer(
        { email, password, role: "Customer" },
        { name, phone },
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
            Register as Customer
          </Text>
          <Text style={[styles.subtitle, { color: colours.textMuted }]}>
            Create your account to start booking appointments
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
              placeholder="Full Name"
              placeholderTextColor={colours.textMuted}
              value={name}
              onChangeText={setName}
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
                {
                  backgroundColor: colours.inputBg,
                  color: colours.text,
                  borderColor: colours.border,
                },
              ]}
              placeholder="Phone Number"
              placeholderTextColor={colours.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
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
