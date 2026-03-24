// =====================================================
// = MessageInput Component                            =
// = Text input area with send button, emoji & attach  =
// =====================================================

import { EmojiPicker } from "@/components/messaging/EmojiPicker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getExtendedColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
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

export function MessageInput({
  onSend,
  onAttachment,
  disabled = false,
}: MessageInputProps) {
  const { isDarkMode, colors: theme } = useTheme();
  const extendedColors = getExtendedColors(isDarkMode);

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

  // Handle Enter key - send on web/desktop, new line on mobile
  const handleKeyPress = (event: {
    nativeEvent: { key: string; shiftKey?: boolean };
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
            borderTopColor: extendedColors.borderAlt,
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
              color={disabled ? theme.icon : theme.icon}
              style={{ transform: [{ rotate: "-45deg" }] }}
            />
          </Pressable>
        )}

        {/* Text input */}
        <View
          style={[
            styles.inputContainer,
            {
              minHeight: inputHeight,
              backgroundColor: isDarkMode ? extendedColors.cardAlt : extendedColors.background,
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
              { backgroundColor: isDarkMode ? extendedColors.textMuted : "#c4c4c4" },
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
});

export default MessageInput;
