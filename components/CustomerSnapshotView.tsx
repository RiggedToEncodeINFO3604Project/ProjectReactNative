import { useTheme } from "@/context/ThemeContext";
import { CustomerSnapshot } from "@/types/scheduling";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";

interface CustomerSnapshotViewProps {
  snapshot: CustomerSnapshot;
  onClose: () => void;
}

export default function CustomerSnapshotView({
  snapshot,
  onClose,
}: CustomerSnapshotViewProps) {
  const { isDarkMode } = useTheme();

  // Log when snapshot data is received
  console.log("[CustomerSnapshotView] Received snapshot:", snapshot);
  console.log("[DEBUG] snapshot type:", typeof snapshot);
  console.log(
    "[DEBUG] snapshot keys:",
    snapshot ? Object.keys(snapshot) : "null",
  );
  console.log("[DEBUG] customer_name value:", snapshot?.customer_name);
  console.log("[DEBUG] customer_name type:", typeof snapshot?.customer_name);
  console.log(
    "[DEBUG] is customer_name null?:",
    snapshot?.customer_name === null,
  );
  console.log(
    "[DEBUG] is customer_name empty string?:",
    snapshot?.customer_name === "",
  );
  console.log(
    "[DEBUG] customer_name trimmed:",
    snapshot?.customer_name?.trim(),
  );

  // Check if snapshot is null/undefined
  if (!snapshot) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? "#151718" : "#f5f5f5" },
        ]}
      >
        <View
          style={[
            styles.noDataContainer,
            { backgroundColor: isDarkMode ? "#1e2333" : "#ffffff" },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={48} color="#9BA1A6" />
          <Text
            style={[
              styles.noDataText,
              { color: isDarkMode ? "#ECEDEE" : "#11181C" },
            ]}
          >
            No data available
          </Text>
        </View>
      </View>
    );
  }

  // tried memo here as well for color reloading - wasn't the problem but i'll keep it for now
  const colors = useMemo(
    () => ({
      background: isDarkMode ? "#151718" : "#f5f5f5",
      card: isDarkMode ? "#1e2333" : "#ffffff",
      text: isDarkMode ? "#ECEDEE" : "#11181C",
      textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
      border: isDarkMode ? "#2a2f3e" : "#dee2e6",
      accent: "#f0c85a",
      inputBg: isDarkMode ? "#1a1f2e" : "#e9ecef",
      error: "#FF3B30",
      success: "#34C759",
      lightAccent: isDarkMode ? "#2a2530" : "#fef3c7",
    }),
    [isDarkMode],
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not available";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number | undefined | null) => {
    return `$${(amount ?? 0).toFixed(2)}`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerContent}>
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: colors.accent },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {(snapshot.customer_name?.charAt(0) ?? "?").toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: colors.text }]}>
              {snapshot.customer_name ?? "Unknown Customer"}
            </Text>
            <Text style={[styles.email, { color: colors.textMuted }]}>
              {snapshot.customer_email ?? "No email available"}
            </Text>
          </View>
        </View>
      </View>

      {/* Contact Information */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          Contact Information
        </Text>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={18} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            {snapshot.customer_phone ?? "No phone available"}
          </Text>
        </View>
      </View>

      {/* Statistics */}
      <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {snapshot.total_visits ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Total Visits
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {formatCurrency(snapshot.total_spent)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Total Spent
          </Text>
        </View>
      </View>

      {/* Last Service */}
      {snapshot.last_service_date && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            Last Service
          </Text>
          <View style={styles.serviceInfo}>
            <View>
              <Text style={[styles.serviceDate, { color: colors.text }]}>
                {formatDate(snapshot.last_service_date)}
              </Text>
              <Text style={[styles.serviceName, { color: colors.textMuted }]}>
                {snapshot.last_service_name ?? "Unknown service"}
              </Text>
            </View>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.success}
            />
          </View>
        </View>
      )}

      {/* Payment Preference */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          Payment Preference
        </Text>
        <View
          style={[
            styles.paymentBadge,
            { backgroundColor: colors.inputBg, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.paymentText, { color: colors.text }]}>
            {snapshot.payment_preference ?? "Not specified"}
          </Text>
        </View>
      </View>

      {/* Tags */}
      {snapshot.tags?.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            Tags
          </Text>
          <View style={styles.tagsContainer}>
            {(snapshot.tags ?? []).map((tag) => (
              <View
                key={tag.id ?? Math.random().toString()}
                style={[
                  styles.tag,
                  {
                    backgroundColor: (tag.color ?? "#999") + "33",
                    borderColor: tag.color ?? "#999",
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: tag.color ?? "#999" }]}>
                  {tag.tag ?? "Untitled"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      {snapshot.notes?.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            Notes
          </Text>
          <FlatList
            scrollEnabled={false}
            data={snapshot.notes ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.noteText, { color: colors.text }]}>
                  {item.note ?? "No note content"}
                </Text>
                <Text
                  style={[styles.noteDate, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  Updated {formatDate(item.updated_at)}
                </Text>
              </View>
            )}
          />
        </View>
      )}

      {!snapshot.notes?.length && !snapshot.tags?.length && (
        <View
          style={[
            styles.emptyState,
            { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={32}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
            No tags or notes yet
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  serviceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceDate: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 13,
  },
  paymentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  paymentText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noteCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  noteDate: {
    fontSize: 11,
  },
  emptyState: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: 12,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 24,
    borderRadius: 12,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },
});
