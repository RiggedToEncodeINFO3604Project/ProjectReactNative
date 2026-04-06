import { useTheme } from "@/context/ThemeContext";
import { CustomerSnapshot } from "@/types/scheduling";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface CustomerSnapshotViewProps {
  snapshot: CustomerSnapshot;
  onClose: () => void;
  onTagAdded?: () => void;
  onTagUpdated?: () => void;
  onTagDeleted?: () => void;
  onNoteAdded?: () => void;
  onNoteUpdated?: () => void;
  onNoteDeleted?: () => void;
}

export default function CustomerSnapshotView({
  snapshot,
  onClose,
  onTagAdded,
  onTagUpdated,
  onTagDeleted,
  onNoteAdded,
  onNoteUpdated,
  onNoteDeleted,
}: CustomerSnapshotViewProps) {
  const { isDarkMode } = useTheme();

  // Modal states
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagEditMode, setTagEditMode] = useState(false);
  const [selectedTag, setSelectedTag] = useState<{
    id: string;
    tag: string;
    color: string;
  } | null>(null);
  const [tagText, setTagText] = useState("");
  const [tagColor, setTagColor] = useState("#42BBEB");

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteEditMode, setNoteEditMode] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{
    id: string;
    note: string;
  } | null>(null);
  const [noteText, setNoteText] = useState("");

  const [showEditTagsPanel, setShowEditTagsPanel] = useState(false);
  const [showEditNotesPanel, setShowEditNotesPanel] = useState(false);

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

  // Tags directly from snapshot
  const sortedTags = useMemo(() => {
    return snapshot.tags || [];
  }, [snapshot.tags]);

  // Tag management handlers
  const openNewTagModal = () => {
    setTagEditMode(false);
    setTagText("");
    setTagColor("#42BBEB");
    setSelectedTag(null);
    setTagModalVisible(true);
  };

  const openEditTagModal = (tag: {
    id: string;
    tag: string;
    color: string;
  }) => {
    setTagEditMode(true);
    setTagText(tag.tag);
    setTagColor(tag.color);
    setSelectedTag(tag);
    setTagModalVisible(true);
  };

  const handleSaveTag = async () => {
    if (!tagText.trim()) return;

    try {
      if (tagEditMode && selectedTag) {
        // Update tag
        const { updateCustomerTag } = await import("@/services/schedulingApi");
        const tagData = {
          tag: tagText,
          color: tagColor,
        };
        await updateCustomerTag(selectedTag.id, tagData);
        onTagUpdated?.();
      } else {
        // Create tag
        const { createCustomerTag } = await import("@/services/schedulingApi");
        await createCustomerTag(snapshot.customer_id, {
          tag: tagText,
          color: tagColor,
        });
        onTagAdded?.();
      }
      setTagModalVisible(false);
    } catch (error: any) {
      console.error("Error saving tag:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      const errorMessage =
        error.response?.data?.detail || error.message || "Failed to save tag";
      alert(errorMessage);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const { deleteCustomerTag } = await import("@/services/schedulingApi");
      await deleteCustomerTag(tagId);
      onTagDeleted?.();
      setTagModalVisible(false);
    } catch (error: any) {
      console.error("Error deleting tag:", {
        message: error.message,
        response: error.response?.data,
      });
      alert(
        `Failed to delete tag: ${error.response?.data?.detail || error.message}`,
      );
    }
  };

  // Note management handlers
  const openNewNoteModal = () => {
    setNoteEditMode(false);
    setNoteText("");
    setSelectedNote(null);
    setNoteModalVisible(true);
  };

  const openEditNoteModal = (note: { id: string; note: string }) => {
    setNoteEditMode(true);
    setNoteText(note.note);
    setSelectedNote(note);
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;

    try {
      if (noteEditMode && selectedNote) {
        // Update note
        const { updateCustomerNote } = await import("@/services/schedulingApi");
        await updateCustomerNote(selectedNote.id, { note: noteText });
        onNoteUpdated?.();
      } else {
        // Create note
        const { createCustomerNote } = await import("@/services/schedulingApi");
        await createCustomerNote(snapshot.customer_id, { note: noteText });
        onNoteAdded?.();
      }
      setNoteModalVisible(false);
    } catch (error: any) {
      console.error("Error saving note:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      const errorMessage =
        error.response?.data?.detail || error.message || "Failed to save note";
      alert(errorMessage);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { deleteCustomerNote } = await import("@/services/schedulingApi");
      await deleteCustomerNote(noteId);
      onNoteDeleted?.();
      setNoteModalVisible(false);
    } catch (error: any) {
      console.error("Error deleting note:", {
        message: error.message,
        response: error.response?.data,
      });
      alert(
        `Failed to delete note: ${error.response?.data?.detail || error.message}`,
      );
    }
  };

  // Color picker options
  const colorOptions = [
    "#34C759",
    "#42BBEB",
    "#FF9500",
    "#AF52DE",
    "#FF3B30",
    "#8E8E93",
    "#FFCC00",
    "#f0c85a",
  ];

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
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            Tags
          </Text>
          <TouchableOpacity
            onPress={() => setShowEditTagsPanel(!showEditTagsPanel)}
          >
            <Text style={[styles.editButton, { color: colors.accent }]}>
              {showEditTagsPanel ? "Done" : "Edit"}
            </Text>
          </TouchableOpacity>
        </View>

        {showEditTagsPanel ? (
          // Edit mode - tags are clickable
          <View style={styles.tagsContainer}>
            {sortedTags.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tag,
                  {
                    backgroundColor: (tag.color ?? "#999") + "33",
                    borderColor: tag.color ?? "#999",
                  },
                ]}
                onPress={() => openEditTagModal(tag)}
              >
                <Text style={[styles.tagText, { color: tag.color ?? "#999" }]}>
                  {tag.tag ?? "Untitled"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // Display mode
          <View style={styles.tagsContainer}>
            {sortedTags.map((tag) => (
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
            {/* Add new tag button */}
            <TouchableOpacity
              style={[
                styles.tag,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
              onPress={openNewTagModal}
            >
              <Text
                style={[styles.tagText, { color: colors.accent, fontSize: 12 }]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notes */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            Notes
          </Text>
          <TouchableOpacity
            onPress={() => setShowEditNotesPanel(!showEditNotesPanel)}
          >
            <Text style={[styles.editButton, { color: colors.accent }]}>
              {showEditNotesPanel ? "Done" : "Edit"}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          scrollEnabled={false}
          data={snapshot.notes ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.noteItemContainer}>
              <View
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    flex: 1,
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
              {showEditNotesPanel && (
                <>
                  <TouchableOpacity
                    onPress={() => openEditNoteModal(item)}
                    style={styles.noteActionButton}
                  >
                    <Ionicons name="pencil" size={16} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteNote(item.id)}
                    style={styles.noteActionButton}
                  >
                    <Ionicons name="trash" size={16} color={colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        />

        {/* Add new note button */}
        <TouchableOpacity
          style={[
            styles.noteCard,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              justifyContent: "center",
              alignItems: "center",
              minHeight: 50,
            },
          ]}
          onPress={openNewNoteModal}
        >
          <Text
            style={[styles.tagText, { color: colors.accent, fontSize: 14 }]}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAG MODAL */}
      <Modal
        visible={tagModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTagModalVisible(false)}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {tagEditMode ? "Edit Tag" : "Add New Tag"}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Tag Name
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
                placeholder="Enter tag name"
                placeholderTextColor={colors.textMuted}
                value={tagText}
                onChangeText={setTagText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Tag Color
              </Text>
              <View style={styles.colorPicker}>
                {colorOptions.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: color,
                        borderWidth: tagColor === color ? 3 : 0,
                        borderColor: colors.text,
                      },
                    ]}
                    onPress={() => setTagColor(color)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={() => setTagModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              {tagEditMode && selectedTag && (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.error },
                  ]}
                  onPress={() => handleDeleteTag(selectedTag.id)}
                >
                  <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleSaveTag}
              >
                <Text style={[styles.modalButtonText, { color: "#000" }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NOTE MODAL */}
      <Modal
        visible={noteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {noteEditMode ? "Edit Note" : "Add New Note"}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Note
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.noteInput,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Enter note"
                placeholderTextColor={colors.textMuted}
                value={noteText}
                onChangeText={setNoteText}
                multiline={true}
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.inputBg },
                ]}
                onPress={() => setNoteModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              {noteEditMode && selectedNote && (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.error },
                  ]}
                  onPress={() => handleDeleteNote(selectedNote.id)}
                >
                  <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={handleSaveNote}
              >
                <Text style={[styles.modalButtonText, { color: "#000" }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  weightBadge: {
    marginLeft: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  weightBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "white",
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editButton: {
    fontSize: 14,
    fontWeight: "600",
  },
  tagEditRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  tagActionButton: {
    padding: 8,
  },
  noteItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  noteActionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
