// =====================================================
// = MessageInput Component                            =
// = Text input area with send button, emoji & attach  =
// =====================================================

import { EmojiPicker } from "@/components/messaging/EmojiPicker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getExtendedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native";

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendImageFile?: () => Promise<void> | void;
  onSendImageUrl?: (imageUrl: string, caption?: string) => Promise<void> | void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onSendImageFile,
  onSendImageUrl,
  disabled = false,
}: MessageInputProps) {
  const { isDarkMode, colours: theme } = useTheme();
  const extendedColours = getExtendedColours(isDarkMode);

  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const inputRef = useRef<TextInputType>(null);

  const isEmpty = text.trim().length === 0;
  const canSend = !isEmpty && !disabled;
  const canSendImageUrl =
    !!imageUrl.trim() && !disabled && typeof onSendImageUrl === "function";

  const handleSend = () => {
    if (!canSend) return;

    const trimmedText = text.trim();
    onSend(trimmedText);
    setText("");
    setInputHeight(44);
    setShowEmojiPicker(false);
  };

  const closeAttachmentModal = useCallback(() => {
    setShowAttachmentModal(false);
    setImageUrl("");
    setImageCaption("");
  }, []);

  const handleSendImageUrl = useCallback(() => {
    if (!canSendImageUrl || !onSendImageUrl) return;

    onSendImageUrl(imageUrl.trim(), imageCaption.trim());
    closeAttachmentModal();
  }, [
    canSendImageUrl,
    closeAttachmentModal,
    imageCaption,
    imageUrl,
    onSendImageUrl,
  ]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prevText) => prevText + emoji);

    // Add to recent emojis (limit to 20)
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      return [emoji, ...filtered].slice(0, 20);
    });
  }, []);

  const toggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker((prev) => !prev);
    if (showEmojiPicker) {
      // Focus back on input when closing picker
      inputRef.current?.focus();
    }
  }, [showEmojiPicker]);

  const handleContentSizeChange = (event: {
    nativeEvent: { contentSize: { height: number } };
  }) => {
    // Auto-expand up to max height
    const newHeight = Math.min(
      Math.max(44, event.nativeEvent.contentSize.height),
      120,
    );
    setInputHeight(newHeight);
  };

  // Handle Enter key - send on web/desktop, new line on mobile
  const handleKeyPress = (event: {
    preventDefault?: () => void;
    nativeEvent: {
      key: string;
      shiftKey?: boolean;
    };
  }) => {
    // Only handle Enter key on web platform
    if (Platform.OS === "web" && event.nativeEvent.key === "Enter") {
      // If Shift is pressed, allow new line (default behavior)
      // If Enter alone is pressed, send the message
      if (!event.nativeEvent.shiftKey) {
        event.preventDefault?.();
        handleSend();
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            borderTopColor: extendedColours.borderAlt,
          },
        ]}
      >
        {/* Emoji button */}
        <Pressable
          onPress={toggleEmojiPicker}
          disabled={disabled}
          style={[styles.iconButton, disabled && styles.disabledButton]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.emojiButtonText}>😊</Text>
        </Pressable>

        {/* Attachment button */}
        {(onSendImageFile || onSendImageUrl) && (
          <Pressable
            onPress={() => setShowAttachmentModal(true)}
            disabled={disabled}
            style={[styles.iconButton, disabled && styles.disabledButton]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol
              name="paperclip"
              size={24}
              color={disabled ? theme.icon : theme.icon}
            />
          </Pressable>
        )}

        {/* Text input */}
        <View
          style={[
            styles.inputContainer,
            {
              minHeight: inputHeight,
              backgroundColor: isDarkMode ? extendedColours.cardAlt : extendedColours.background,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              { height: Math.max(44, inputHeight), color: theme.text },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={theme.icon}
            multiline
            maxLength={1000}
            editable={!disabled}
            onContentSizeChange={handleContentSizeChange}
            onKeyPress={handleKeyPress}
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (canSend) handleSend();
            }}
          />
        </View>

        {/* Send button */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.sendButton,
            { backgroundColor: theme.tint },
            !canSend && [
              styles.sendButtonDisabled,
              { backgroundColor: isDarkMode ? extendedColours.textMuted : "#c4c4c4" },
            ],
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol
            name="paperplane.fill"
            size={20}
            color={theme.background}
          />
        </Pressable>
      </View>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        recentEmojis={recentEmojis}
      />

      <Modal
        animationType="slide"
        transparent
        visible={showAttachmentModal}
        onRequestClose={closeAttachmentModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.background,
                borderColor: extendedColours.borderAlt,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Send Image
            </Text>

            {Platform.OS === "web" && onSendImageFile ? (
              <Pressable
                onPress={() => {
                  closeAttachmentModal();
                  onSendImageFile();
                }}
                disabled={disabled}
                style={[
                  styles.attachmentAction,
                  {
                    backgroundColor: isDarkMode
                      ? extendedColours.cardAlt
                      : extendedColours.background,
                  },
                ]}
              >
                <Text style={[styles.attachmentActionText, { color: theme.text }]}>
                  Choose image from device
                </Text>
              </Pressable>
            ) : null}

            {onSendImageUrl ? (
              <>
                <TextInput
                  style={[
                    styles.attachmentInput,
                    {
                      color: theme.text,
                      borderColor: extendedColours.borderAlt,
                      backgroundColor: isDarkMode
                        ? extendedColours.cardAlt
                        : extendedColours.background,
                    },
                  ]}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  placeholder="Paste an image URL"
                  placeholderTextColor={theme.icon}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[
                    styles.attachmentInput,
                    styles.captionInput,
                    {
                      color: theme.text,
                      borderColor: extendedColours.borderAlt,
                      backgroundColor: isDarkMode
                        ? extendedColours.cardAlt
                        : extendedColours.background,
                    },
                  ]}
                  value={imageCaption}
                  onChangeText={setImageCaption}
                  placeholder="Optional caption"
                  placeholderTextColor={theme.icon}
                  multiline
                />
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeAttachmentModal}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: isDarkMode
                      ? extendedColours.cardAlt
                      : extendedColours.background,
                  },
                ]}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </Pressable>
              {onSendImageUrl ? (
                <Pressable
                  onPress={handleSendImageUrl}
                  disabled={!canSendImageUrl}
                  style={[
                    styles.modalButton,
                    styles.primaryModalButton,
                    { backgroundColor: theme.tint },
                    !canSendImageUrl && styles.disabledButton,
                  ]}
                >
                  <Text
                    style={[styles.modalButtonText, { color: theme.background }]}
                  >
                    Send URL
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  iconButton: {
    padding: 8,
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
    height: 44,
  },
  emojiButtonText: {
    fontSize: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
    maxHeight: 120,
  },
  input: {
    fontSize: 16,
    paddingTop: 10,
    paddingBottom: 10,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowOpacity: 0.3,
    elevation: 4,
  },
  sendButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  attachmentAction: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  attachmentActionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  attachmentInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  captionInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryModalButton: {
    minWidth: 96,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default MessageInput;
