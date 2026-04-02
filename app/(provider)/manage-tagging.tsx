import { useTheme } from "@/context/ThemeContext";
import {
    getTaggingRules,
    TaggingConfig,
    updateTaggingRules,
} from "@/services/schedulingApi";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function ManageTaggingScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [config, setConfig] = useState<TaggingConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "frequency",
  );

  // Local state for editable values
  const [taggingEnabled, setTaggingEnabled] = useState(true);
  const [tagPriority, setTagPriority] = useState<
    "auto_first" | "manual_first" | "merge"
  >("manual_first");
  const [phase1Enabled, setPhase1Enabled] = useState(true);
  const [phase2Enabled, setPhase2Enabled] = useState(true);
  const [phase3Enabled, setPhase3Enabled] = useState(true);
  const [phase4Enabled, setPhase4Enabled] = useState(true);

  // Frequency thresholds
  const [returningThreshold, setReturningThreshold] = useState("2");
  const [regularThreshold, setRegularThreshold] = useState("5");
  const [loyalThreshold, setLoyalThreshold] = useState("10");

  // Spending thresholds
  const [regularSpenderThreshold, setRegularSpenderThreshold] = useState("100");
  const [highValueThreshold, setHighValueThreshold] = useState("500");
  const [premiumThreshold, setPremiumThreshold] = useState("1000");

  // Recency thresholds
  const [activeDays, setActiveDays] = useState("30");
  const [atRiskDays, setAtRiskDays] = useState("180");

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, []),
  );

  const loadConfig = async () => {
    setLoading(true);
    try {
      const rules = await getTaggingRules();
      setConfig(rules);

      // Populate state from loaded config
      setTaggingEnabled(rules.enabled ?? true);
      setTagPriority(rules.tag_priority ?? "manual_first");
      setPhase1Enabled(rules.enable_phases?.phase1 ?? true);
      setPhase2Enabled(rules.enable_phases?.phase2 ?? true);
      setPhase3Enabled(rules.enable_phases?.phase3 ?? true);
      setPhase4Enabled(rules.enable_phases?.phase4 ?? true);

      if (rules.frequency_thresholds) {
        setReturningThreshold(
          String(rules.frequency_thresholds.returning || 2),
        );
        setRegularThreshold(String(rules.frequency_thresholds.regular || 5));
        setLoyalThreshold(String(rules.frequency_thresholds.loyal || 10));
      }

      if (rules.spending_thresholds) {
        setRegularSpenderThreshold(
          String(rules.spending_thresholds.regular_spender || 100),
        );
        setHighValueThreshold(
          String(rules.spending_thresholds.high_value || 500),
        );
        setPremiumThreshold(String(rules.spending_thresholds.premium || 1000));
      }

      if (rules.recency_thresholds) {
        setActiveDays(String(rules.recency_thresholds.active_days || 30));
        setAtRiskDays(String(rules.recency_thresholds.at_risk_days || 180));
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load tagging configuration",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const updatedConfig: Partial<TaggingConfig> = {
        enabled: taggingEnabled,
        tag_priority: tagPriority,
        frequency_thresholds: {
          returning: parseInt(returningThreshold) || 2,
          regular: parseInt(regularThreshold) || 5,
          loyal: parseInt(loyalThreshold) || 10,
        },
        spending_thresholds: {
          regular_spender: parseInt(regularSpenderThreshold) || 100,
          high_value: parseInt(highValueThreshold) || 500,
          premium: parseInt(premiumThreshold) || 1000,
        },
        recency_thresholds: {
          active_days: parseInt(activeDays) || 30,
          at_risk_days: parseInt(atRiskDays) || 180,
        },
        enable_phases: {
          phase1: phase1Enabled,
          phase2: phase2Enabled,
          phase3: phase3Enabled,
          phase4: phase4Enabled,
        },
      };

      await updateTaggingRules(updatedConfig);
      setConfig(updatedConfig);
      Alert.alert("Success", "Auto-tagging configuration saved successfully");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to save configuration",
      );
    } finally {
      setSaving(false);
    }
  };

  const colors = {
    background: isDarkMode ? "#151718" : "#f5f5f5",
    card: isDarkMode ? "#1e2333" : "#ffffff",
    text: isDarkMode ? "#ECEDEE" : "#11181C",
    textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
    border: isDarkMode ? "#2a2f3e" : "#dee2e6",
    accent: "#f0c85a",
    inputBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
    success: "#34C759",
    warning: "#FF9500",
    error: "#FF3B30",
  };

  const SectionHeader = ({
    title,
    sectionKey,
  }: {
    title: string;
    sectionKey: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.sectionHeader,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
      onPress={() =>
        setExpandedSection(expandedSection === sectionKey ? null : sectionKey)
      }
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Ionicons
        name={expandedSection === sectionKey ? "chevron-up" : "chevron-down"}
        size={20}
        color={colors.accent}
      />
    </TouchableOpacity>
  );

  const ThresholdInput = ({
    label,
    value,
    onChangeText,
    helpText,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    helpText?: string;
  }) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
      />
      {helpText && (
        <Text style={[styles.helpText, { color: colors.textMuted }]}>
          {helpText}
        </Text>
      )}
    </View>
  );

  const PhaseToggle = ({
    label,
    value,
    onToggle,
    description,
  }: {
    label: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    description: string;
  }) => (
    <View
      style={[
        styles.toggleRow,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.toggleDescription, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.success }}
        thumbColor={value ? colors.success : colors.textMuted}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.accent }]}>
              ← Back
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Auto-Tagging Settings
          </Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Master Toggle */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Enable Auto-Tagging
              </Text>
              <Text
                style={[styles.toggleDescription, { color: colors.textMuted }]}
              >
                Turn on/off automatic tag generation for all customers
              </Text>
            </View>
            <Switch
              value={taggingEnabled}
              onValueChange={setTaggingEnabled}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={taggingEnabled ? colors.success : colors.textMuted}
            />
          </View>
        </View>

        {/* Tag Priority */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Tag Priority Mode
          </Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            Control how manual and auto-generated tags interact
          </Text>
          <View style={styles.priorityButtons}>
            {(["manual_first", "auto_first", "merge"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.priorityButton,
                  {
                    backgroundColor:
                      tagPriority === mode ? colors.accent : colors.inputBg,
                    borderColor:
                      tagPriority === mode ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setTagPriority(mode)}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    { color: tagPriority === mode ? "#000" : colors.text },
                  ]}
                >
                  {mode === "manual_first"
                    ? "Manual First"
                    : mode === "auto_first"
                      ? "Auto First"
                      : "Merge"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Phases Toggle */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Analysis Phases
          </Text>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            Enable/disable specific tagging features
          </Text>

          <PhaseToggle
            label="Phase 1: Basics"
            value={phase1Enabled}
            onToggle={setPhase1Enabled}
            description="Frequency, Recency, Spending"
          />
          <PhaseToggle
            label="Phase 2: Behavior"
            value={phase2Enabled}
            onToggle={setPhase2Enabled}
            description="Booking patterns, Time preferences, Cancellations"
          />
          <PhaseToggle
            label="Phase 3: Advanced"
            value={phase3Enabled}
            onToggle={setPhase3Enabled}
            description="Service preferences, Communication patterns"
          />
          <PhaseToggle
            label="Phase 4: Customization"
            value={phase4Enabled}
            onToggle={setPhase4Enabled}
            description="Color customization, Priority rules"
          />
        </View>

        {/* Frequency Thresholds */}
        <SectionHeader title="Frequency Thresholds" sectionKey="frequency" />
        {expandedSection === "frequency" && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <ThresholdInput
              label="Returning (visits ≥)"
              value={returningThreshold}
              onChangeText={setReturningThreshold}
              helpText="Customer is tagged 'Returning' at this visit count"
            />
            <ThresholdInput
              label="Regular (visits ≥)"
              value={regularThreshold}
              onChangeText={setRegularThreshold}
              helpText="Customer is tagged 'Regular' at this visit count"
            />
            <ThresholdInput
              label="Loyal (visits ≥)"
              value={loyalThreshold}
              onChangeText={setLoyalThreshold}
              helpText="Customer is tagged 'Loyal' at this visit count"
            />
          </View>
        )}

        {/* Spending Thresholds */}
        <SectionHeader title="Spending Thresholds" sectionKey="spending" />
        {expandedSection === "spending" && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <ThresholdInput
              label="Regular Spender ($)"
              value={regularSpenderThreshold}
              onChangeText={setRegularSpenderThreshold}
              helpText="Customer is tagged 'Regular Spender' above this amount"
            />
            <ThresholdInput
              label="High Value ($)"
              value={highValueThreshold}
              onChangeText={setHighValueThreshold}
              helpText="Customer is tagged 'High Value' above this amount"
            />
            <ThresholdInput
              label="Premium ($)"
              value={premiumThreshold}
              onChangeText={setPremiumThreshold}
              helpText="Customer is tagged 'Premium' above this amount"
            />
          </View>
        )}

        {/* Recency Thresholds */}
        <SectionHeader title="Recency Thresholds" sectionKey="recency" />
        {expandedSection === "recency" && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <ThresholdInput
              label="Active Days"
              value={activeDays}
              onChangeText={setActiveDays}
              helpText="Last service within this many days = 'Active'"
            />
            <ThresholdInput
              label="At Risk Days"
              value={atRiskDays}
              onChangeText={setAtRiskDays}
              helpText="Last service within this many days = 'At Risk', beyond = 'Inactive'"
            />
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: colors.accent,
              opacity: saving ? 0.6 : 1,
            },
          ]}
          onPress={handleSaveConfig}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveButtonText}>Save Configuration</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
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
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  backText: {
    fontSize: 16,
  },
  card: {
    margin: 15,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 0,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  priorityButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1.5,
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  saveButton: {
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#151718",
    fontSize: 16,
    fontWeight: "600",
  },
});
