import { IconSymbol } from "@/components/ui/icon-symbol";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";

// Types
interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  sections?: string[];
}

interface QuickAction {
  label: string;
  icon: string;
  query: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Book appointment",
    icon: "📅",
    query: "How do I book an appointment?",
  },
  { label: "Payment security", icon: "🔒", query: "Is my credit card safe?" },
  {
    label: "Cancel appointment",
    icon: "✂️",
    query: "How do I cancel my haircut?",
  },
  {
    label: "Grow my business",
    icon: "📈",
    query: "How can I grow my business on Skedulelt?",
  },
];

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function Chatbot() {
  const { isDarkMode } = useTheme();

  // Theme-based colors
  const COLORS = isDarkMode
    ? {
        bgDeep: "#0c0e12",
        bgCard: "#141820",
        bgInput: "#1a1f2e",
        accent: "#f0c85a",
        accentDim: "#c9a43a",
        textPrimary: "#eef0f4",
        textMuted: "#6b7280",
        textDim: "#4a5060",
        border: "#2a2f3e",
        bubbleBot: "#1e2333",
      }
    : {
        bgDeep: "#ffffff",
        bgCard: "#f8f9fa",
        bgInput: "#e9ecef",
        accent: "#f0c85a",
        accentDim: "#d4a84b",
        textPrimary: "#11181C",
        textMuted: "#6b7280",
        textDim: "#9ca3af",
        border: "#dee2e6",
        bubbleBot: "#f1f3f4",
      };

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [welcomeOpacity] = useState(new Animated.Value(1));

  const scrollViewRef = useRef<ScrollView>(null);
  const typingAnim1 = useRef(new Animated.Value(0)).current;
  const typingAnim2 = useRef(new Animated.Value(0)).current;
  const typingAnim3 = useRef(new Animated.Value(0)).current;

  // Animation refs for cleanup
  const animRefs = useRef<Animated.CompositeAnimation[]>([]);

  // Start typing indicator animation
  const startTypingAnimation = useCallback(() => {
    const createDotAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    animRefs.current = [
      createDotAnimation(typingAnim1, 0),
      createDotAnimation(typingAnim2, 150),
      createDotAnimation(typingAnim3, 300),
    ];

    animRefs.current.forEach((anim) => anim.start());
  }, [typingAnim1, typingAnim2, typingAnim3]);

  // Stop typing indicator animation
  const stopTypingAnimation = useCallback(() => {
    animRefs.current.forEach((anim) => anim.stop());
    animRefs.current = [];
    typingAnim1.setValue(0);
    typingAnim2.setValue(0);
    typingAnim3.setValue(0);
  }, [typingAnim1, typingAnim2, typingAnim3]);

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Hide welcome screen with animation
  const hideWelcome = useCallback(() => {
    Animated.timing(welcomeOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setHasStarted(true);
    });
  }, [welcomeOpacity]);

  // API call to send message
  const sendToApi = async (
    text: string,
    history: Message[],
  ): Promise<{ answer: string; matchedSections: string[] }> => {
    const historyToSend = history.filter(
      (m) => m.role !== "user" || m.id !== "typing",
    );

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: historyToSend }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  };

  // Send message handler
  const handleSendMessage = useCallback(
    async (text?: string) => {
      const messageText = text?.trim() || inputText.trim();
      if (!messageText || isTyping) return;

      Keyboard.dismiss();

      // Hide welcome screen
      hideWelcome();

      // Create user message
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        text: messageText,
      };

      // Add user message to state
      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setIsTyping(true);
      scrollToBottom();

      // Add temporary typing message
      setMessages((prev) => [...prev, { id: "typing", role: "bot", text: "" }]);

      // Start typing animation
      startTypingAnimation();

      try {
        // Get history excluding the typing message
        const history = messages.filter((m) => m.id !== "typing");

        const data = await sendToApi(messageText, history);

        // Remove typing message and add bot response
        setMessages((prev) => prev.filter((m) => m.id !== "typing"));
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "bot",
            text: data.answer,
            sections: data.matchedSections,
          },
        ]);
      } catch (error) {
        // Remove typing message and add error
        setMessages((prev) => prev.filter((m) => m.id !== "typing"));
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "bot",
            text: `⚠️ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      } finally {
        stopTypingAnimation();
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [
      inputText,
      isTyping,
      messages,
      scrollToBottom,
      startTypingAnimation,
      stopTypingAnimation,
      hideWelcome,
    ],
  );

  // Handle quick action press
  const handleQuickAction = useCallback(
    (query: string) => {
      handleSendMessage(query);
    },
    [handleSendMessage],
  );

  // Handle new chat
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setHasStarted(false);
    setInputText("");
    welcomeOpacity.setValue(1);
    stopTypingAnimation();
    setIsTyping(false);
  }, [welcomeOpacity, stopTypingAnimation]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      stopTypingAnimation();
    };
  }, [stopTypingAnimation]);

  // Render message bubble
  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";

    if (message.id === "typing") {
      return (
        <View key={message.id} style={[styles.messageRow, styles.botRow]}>
          <View style={[styles.avatar, styles.avatarBot]}>
            <Text style={[styles.avatarText, { color: COLORS.textMuted }]}>
              S
            </Text>
          </View>
          <View
            style={[
              styles.bubble,
              styles.typingBubble,
              { backgroundColor: COLORS.bubbleBot, borderColor: COLORS.border },
            ]}
          >
            <View style={styles.typingDots}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: COLORS.textMuted,
                    transform: [
                      {
                        translateY: typingAnim1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -5],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: COLORS.textMuted,
                    transform: [
                      {
                        translateY: typingAnim2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -5],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: COLORS.textMuted,
                    transform: [
                      {
                        translateY: typingAnim3.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -5],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View
        key={message.id}
        style={[styles.messageRow, isUser ? styles.userRow : styles.botRow]}
      >
        <View
          style={[
            styles.avatar,
            isUser ? styles.avatarUser : styles.avatarBot,
            {
              backgroundColor: isUser ? COLORS.accent : COLORS.bgInput,
              borderColor: isUser ? COLORS.accent : COLORS.border,
            },
          ]}
        >
          <Text style={[styles.avatarText, isUser && { color: COLORS.bgDeep }]}>
            {isUser ? "U" : "S"}
          </Text>
        </View>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleBot,
            {
              backgroundColor: isUser ? COLORS.accent : COLORS.bubbleBot,
              borderColor: COLORS.border,
              borderTopLeftRadius: isUser ? 14 : 4,
              borderTopRightRadius: isUser ? 4 : 14,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser && { color: COLORS.bgDeep },
              { color: isUser ? COLORS.bgDeep : COLORS.textPrimary },
            ]}
          >
            {message.text}
          </Text>
          {!isUser && message.sections && message.sections.length > 0 && (
            <View style={styles.sectionsBadge}>
              {message.sections.map((section, index) => (
                <Text
                  key={index}
                  style={[
                    styles.sectionBadgeText,
                    {
                      color: COLORS.accentDim,
                      backgroundColor: `${COLORS.accent}20`,
                      borderColor: `${COLORS.accent}30`,
                    },
                  ]}
                >
                  {section}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: COLORS.bgDeep }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: COLORS.bgCard, borderBottomColor: COLORS.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <Animated.View
            style={[
              styles.logoCircle,
              {
                backgroundColor: COLORS.accent,
                shadowColor: COLORS.accent,
                shadowOpacity: typingAnim1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.28, 0.42],
                }),
              },
            ]}
          >
            <Text style={[styles.logoText, { color: COLORS.bgDeep }]}>S</Text>
          </Animated.View>
          <View style={styles.headerTitles}>
            <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>
              Skedulelt Support Assistant
            </Text>
            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />
              <Text style={[styles.statusText, { color: COLORS.textMuted }]}>
                Powered by Google
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.clearButton, { borderColor: COLORS.border }]}
          onPress={handleNewChat}
          activeOpacity={0.7}
        >
          <Text style={[styles.clearButtonText, { color: COLORS.textMuted }]}>
            ↺ New Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Welcome Screen (shown before first message) */}
      {!hasStarted && (
        <Animated.View
          style={[styles.welcomeContainer, { opacity: welcomeOpacity }]}
        >
          <Text style={[styles.welcomeTitle, { color: COLORS.textPrimary }]}>
            Hey there 👋
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: COLORS.textMuted }]}>
            I'm the Skedulelt support assistant. Ask me anything about booking,
            payments, or policies in Trinidad & Tobago.
          </Text>
          <View style={styles.chipsContainer}>
            {QUICK_ACTIONS.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.chip,
                  {
                    backgroundColor: COLORS.bgInput,
                    borderColor: COLORS.border,
                  },
                ]}
                onPress={() => handleQuickAction(action.query)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{action.icon}</Text>
                <Text style={[styles.chipText, { color: COLORS.textMuted }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(renderMessage)}
        {messages.length === 0 && hasStarted && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: COLORS.textMuted }]}>
              Start a conversation...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View
        style={[
          styles.inputBar,
          { backgroundColor: COLORS.bgCard, borderTopColor: COLORS.border },
        ]}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: COLORS.bgInput,
                borderColor: COLORS.border,
                color: COLORS.textPrimary,
              },
            ]}
            placeholder="Type your question…"
            placeholderTextColor={COLORS.textDim}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendMessage()}
            multiline
            maxLength={1000}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: COLORS.accent },
              (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.7}
          >
            <Animated.View
              style={[
                styles.sendButtonInner,
                {
                  transform:
                    Platform.OS === "web"
                      ? [
                          { scale: !inputText.trim() || isTyping ? 0.95 : 1 },
                          { scaleX: 1 },
                          { translateX: 3.5 },
                          { translateY: -2 },
                        ]
                      : [
                          { scale: !inputText.trim() || isTyping ? 0.95 : 1 },
                          { scaleX: 1 },
                          { scaleY: 1.2 },
                          { translateX: 3.5 },
                        ],
                },
              ]}
            >
              <IconSymbol
                size={35}
                name="paperplane.fill"
                color={COLORS.bgDeep}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: Platform.OS === "ios" ? 80 : 60, // Account for navbar
  },
  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 5,
  },
  logoText: {
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "400",
  },
  headerTitles: {
    flexShrink: 1,
    gap: 2,
  },
  headerTitle: {
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.3,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34d399",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "300",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  clearButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  // Welcome screen styles
  welcomeContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: "center",
  },
  welcomeTitle: {
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "400",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 440,
    lineHeight: 20,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 13,
  },
  // Messages styles
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  messagesContent: {
    paddingVertical: 16,
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  userRow: {
    flexDirection: "row-reverse",
  },
  botRow: {
    flexDirection: "row",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBot: {
    borderWidth: 1,
  },
  avatarUser: {},
  avatarText: {
    fontSize: 13,
    fontWeight: "500",
  },
  avatarTextUser: {},
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  bubbleBot: {
    borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    borderTopRightRadius: 4,
  },
  typingBubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  typingDots: {
    flexDirection: "row",
    gap: 5,
    height: 18,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 23,
  },
  messageTextUser: {
    fontWeight: "500",
  },
  sectionsBadge: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },
  sectionBadgeText: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    letterSpacing: 0.3,
  },
  // Input bar styles
  inputBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 48,
    maxHeight: 140,
    lineHeight: 21,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  inputNote: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 10,
    letterSpacing: 0.2,
  },
});
