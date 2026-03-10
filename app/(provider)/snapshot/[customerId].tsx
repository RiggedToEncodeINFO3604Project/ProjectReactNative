// AI'd display components - will remove deprecated components and manually review and rewrite all display elements before final sprint
import CustomerSnapshotView from "@/components/CustomerSnapshotView";
import { useTheme } from "@/context/ThemeContext";
import { getCustomerSnapshot } from "@/services/schedulingApi";
import { CustomerSnapshot } from "@/types/scheduling";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function CustomerSnapshotScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();

  const [snapshot, setSnapshot] = useState<CustomerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // tracks actual mount/unmount
  useEffect(() => {
    console.log("📱 [customerId] screen mounted");
    console.log("[Snapshot Page] Received customerId from URL:", customerId);
    return () => {
      console.log("📱 [customerId] screen UNMOUNTED");
    };
  }, []);

  // tracking throughout request lifespan - works but snapshot is still null // try delaying snapshot itself to see when request is fulfilled
  useEffect(() => {
    console.log("🔄 State update:");
    console.log("   loading:", loading);
    console.log("   error:", error);
    console.log("   snapshot:", snapshot ? "✓ received" : "null");
    console.log("   customerId:", customerId);
  }, [loading, error, snapshot, customerId]);

  // attempted fix for unmounting - thought colors relaoding was triggering unmount
  const colors = useMemo(
    () => ({
      background: isDarkMode ? "#151718" : "#f5f5f5",
      card: isDarkMode ? "#1e2333" : "#ffffff",
      text: isDarkMode ? "#ECEDEE" : "#11181C",
      textMuted: isDarkMode ? "#9BA1A6" : "#6b7280",
      border: isDarkMode ? "#2a2f3e" : "#dee2e6",
      accent: "#f0c85a",
      error: "#FF3B30",
    }),
    [isDarkMode],
  );

  useEffect(() => {
    mountedRef.current = true;
    // DEBUG: Log the exact customerId value and type
    console.log("[DEBUG Snapshot Page] customerId value:", customerId);
    console.log("[DEBUG Snapshot Page] customerId type:", typeof customerId);
    console.log(
      "[DEBUG Snapshot Page] customerId is array:",
      Array.isArray(customerId),
    );

    // Handle case where customerId might be an array (Expo Router quirk)
    const actualCustomerId = Array.isArray(customerId)
      ? customerId[0]
      : customerId;
    console.log("[DEBUG Snapshot Page] actualCustomerId:", actualCustomerId);

    if (actualCustomerId) {
      loadSnapshot(actualCustomerId);
    } else {
      console.error(
        "[Snapshot Page] Error: customerId is missing from URL params",
      );
      setError("Customer ID is missing. Please go back and try again.");
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [customerId]);

  const loadSnapshot = async (idToLoad?: string) => {
    const targetId =
      idToLoad || (Array.isArray(customerId) ? customerId[0] : customerId);
    console.log("📡 loadSnapshot called, customerId:", targetId);
    console.log("[DEBUG] targetId type:", typeof targetId);
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerSnapshot(targetId);
      console.log("[Snapshot Page] API Response:", response);
      console.log("[DEBUG] Response customer_name:", response?.customer_name);
      console.log("[DEBUG] Response customer_id:", response?.customer_id);
      if (mountedRef.current) setSnapshot(response);
    } catch (err: any) {
      console.error("[DEBUG] loadSnapshot error:", err);
      if (mountedRef.current)
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Failed to load snapshot",
        );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header always stays stable */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Customer Snapshot
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* loading */}
      {loading && (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      {/* error handling */}
      {!loading && error && (
        <View style={styles.centeredContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={() => loadSnapshot()}
          >
            <Text
              style={[styles.retryButtonText, { color: colors.background }]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* only renders when the data is ready - premature render may unmount? */}
      {!loading && !error && snapshot && (
        <>
          {console.log("[Snapshot Page] Snapshot data:", snapshot)}
          <CustomerSnapshotView
            snapshot={snapshot}
            onClose={() => router.back()}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "600" },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
