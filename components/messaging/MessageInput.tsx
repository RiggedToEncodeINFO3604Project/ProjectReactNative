// =====================================================
// = MessageInput Component                            =
// = Text input area with send button, emoji & attach  =
// =====================================================

import { EmojiPicker } from "@/components/messaging/EmojiPicker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
  onAttachment?: () => void;
  disabled?: boolean;
}

const PRIMARY_COLOR = "#0a7ea4";
const DISABLED_COLOR = "#c4c4c4";

export function MessageInput({
  onSend,
  onAttachment,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const inputRef = useRef<TextInputType>(null);

  const isEmpty = text.trim().length === 0;
  const canSend = !isEmpty && !disabled;

  const handleSend = () => {
    if (!canSend) return;

    const trimmedText = text.trim();
    onSend(trimmedText);
    setText("");
    setInputHeight(44);
    setShowEmojiPicker(false);
  };

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
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
        {onAttachment && (
          <Pressable
            onPress={onAttachment}
            disabled={disabled}
            style={[styles.iconButton, disabled && styles.disabledButton]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol
              name="paperplane.fill"
              size={24}
              color={disabled ? DISABLED_COLOR : Colors.light.icon}
              style={{ transform: [{ rotate: "-45deg" }] }}
            />
          </Pressable>
        )}

        {/* Text input */}
        <View style={[styles.inputContainer, { minHeight: inputHeight }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { height: Math.max(44, inputHeight) }]}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={Colors.light.icon}
            multiline
            maxLength={1000}
            editable={!disabled}
            onContentSizeChange={handleContentSizeChange}
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
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="paperplane.fill" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
        recentEmojis={recentEmojis}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
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
    backgroundColor: "#f5f5f5",
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
    maxHeight: 120,
  },
  input: {
    fontSize: 16,
    color: Colors.light.text,
    paddingTop: 10,
    paddingBottom: 10,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowOpacity: 0.3,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: DISABLED_COLOR,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default MessageInput;
