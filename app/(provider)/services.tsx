import { useTheme } from "@/context/ThemeContext";
import { addService, getMyServices } from "@/services/schedulingApi";
import { Service } from "@/types/scheduling";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function ManageServicesScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const results = await getMyServices();
      setServices(results);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to load services",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!serviceName || !serviceDescription || !servicePrice) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await addService({
        name: serviceName,
        description: serviceDescription,
        price: parseFloat(servicePrice),
      });
      setModalVisible(false);
      setServiceName("");
      setServiceDescription("");
      setServicePrice("");
      loadServices();
      Alert.alert("Success", "Service added successfully");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to add service",
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
  };

  const renderService = ({ item }: { item: Service }) => (
    <View
      style={[
        styles.serviceCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.serviceName, { color: colors.text }]}>
        {item.name}
      </Text>
      <Text style={[styles.serviceDescription, { color: colors.textMuted }]}>
        {item.description}
      </Text>
      <Text style={[styles.servicePrice, { color: colors.accent }]}>
        ${item.price}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.text }]}>
          Manage Services
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.accent }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+ Add New Service</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={services}
          renderItem={renderService}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No services yet. Add your first service!
            </Text>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add New Service
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Service Name"
              placeholderTextColor={colors.textMuted}
              value={serviceName}
              onChangeText={setServiceName}
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Description"
              placeholderTextColor={colors.textMuted}
              value={serviceDescription}
              onChangeText={setServiceDescription}
              multiline
              numberOfLines={3}
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
              placeholder="Price"
              placeholderTextColor={colors.textMuted}
              value={servicePrice}
              onChangeText={setServicePrice}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text
                  style={[styles.cancelButtonText, { color: colors.textMuted }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleAddService}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#151718" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backText: {
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  addButton: {
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  addButtonText: {
    color: "#151718",
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    padding: 15,
  },
  serviceCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  serviceDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: "bold",
  },
  loader: {
    marginTop: 50,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 50,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {},
  saveButtonText: {
    color: "#151718",
    fontSize: 16,
    fontWeight: "600",
  },
});
