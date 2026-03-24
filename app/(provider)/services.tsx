import BackButton from "@/components/BackButton";
import { ExtendedColours, SharedColours, UIColours } from "@/constants/theme";
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

  const extendedColours = ExtendedColours[isDarkMode ? "dark" : "light"];

  const colours = {
    background: extendedColours.background,
    card: extendedColours.card,
    text: extendedColours.text,
    textMuted: extendedColours.textMuted,
    border: extendedColours.border,
    accent: SharedColours.bookingStatus.pending,
    inputBg: extendedColours.inputBg,
  };

  const renderService = ({ item }: { item: Service }) => (
    <View
      style={[
        styles.serviceCard,
        { backgroundColor: colours.card, borderColor: colours.border },
      ]}
    >
      <Text style={[styles.serviceName, { color: colours.text }]}>
        {item.name}
      </Text>
      <Text style={[styles.serviceDescription, { color: colours.textMuted }]}>
        {item.description}
      </Text>
      <Text style={[styles.servicePrice, { color: colours.accent }]}>
        ${item.price}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colours.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colours.card, borderBottomColor: colours.border },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.title, { color: colours.text }]}>
          Manage Services
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colours.accent }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+ Add New Service</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colours.accent}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={services}
          renderItem={renderService}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colours.textMuted }]}>
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
          <View style={[styles.modalContent, { backgroundColor: colours.card }]}>
            <Text style={[styles.modalTitle, { color: colours.text }]}>
              Add New Service
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colours.inputBg,
                  color: colours.text,
                  borderColor: colours.border,
                },
              ]}
              placeholder="Service Name"
              placeholderTextColor={colours.textMuted}
              value={serviceName}
              onChangeText={setServiceName}
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
              placeholder="Description"
              placeholderTextColor={colours.textMuted}
              value={serviceDescription}
              onChangeText={setServiceDescription}
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
              placeholder="Price"
              placeholderTextColor={colours.textMuted}
              value={servicePrice}
              onChangeText={setServicePrice}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: colours.border },
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text
                  style={[styles.cancelButtonText, { color: colours.textMuted }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: colours.accent },
                ]}
                onPress={handleAddService}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={UIColours.button.textLight} />
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
    color: UIColours.button.textLight,
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
    backgroundColor: UIColours.overlay,
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
    color: UIColours.button.textLight,
    fontSize: 16,
    fontWeight: "600",
  },
});
