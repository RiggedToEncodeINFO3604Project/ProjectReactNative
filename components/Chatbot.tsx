import { IconSymbol } from "@/components/ui/icon-symbol";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { useTheme } from "@/context/ThemeContext";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Constants from "expo-constants";

// Get API key from environment (supports both .env and app.json extra)
const getApiKey = (): string => {
  // First try process.env (for EXPO_PUBLIC_ prefixed vars)
  if (typeof process !== "undefined" && process.env) {
    const envKey =
      (process.env as Record<string, string>).EXPO_PUBLIC_GEMINI_API_KEY ||
      (process.env as Record<string, string>).GEMINI_API_KEY;
    if (envKey) return envKey;
  }

  // Then try Constants.expoConfig.extra (for app.json extra field)
  const extraKey = Constants.expoConfig?.extra?.GEMINI_API_KEY;
  if (extraKey) return extraKey;

  return "";
};

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

// Parse rich text and return elements for rendering
const parseRichText = (
  text: string,
  COLORS: Record<string, string>,
  isUser: boolean,
) => {
  const elements: React.ReactNode[] = [];
  const lines = text.split("\n");
  let keyCounter = 0;

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (lineIndex > 0) {
        elements.push(
          <View key={`blank-${lineIndex}`} style={styles.blankLine} />,
        );
      }
      return;
    }

    // Check if it's a numbered list (1., 2., etc.)
    const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.*)/);
    // Check if it's a bullet list (-, *, •)
    const bulletMatch = trimmedLine.match(/^([-*•])\s+(.*)/);

    if (numberedMatch || bulletMatch) {
      const prefix = numberedMatch ? numberedMatch[1] + "." : bulletMatch![1];
      const content = numberedMatch ? numberedMatch[2] : bulletMatch![2];

      const lineElements = parseInlineFormatting(
        content,
        COLORS,
        isUser,
        keyCounter,
      );
      elements.push(
        <View key={`list-${lineIndex}`} style={styles.listItem}>
          <Text style={[styles.listPrefix, { color: COLORS.accent }]}>
            {prefix}
          </Text>
          <View style={styles.listContent}>{lineElements}</View>
        </View>,
      );
      keyCounter++;
    } else {
      elements.push(
        <View key={`text-${lineIndex}`} style={styles.textLine}>
          {parseInlineFormatting(trimmedLine, COLORS, isUser, keyCounter)}
        </View>,
      );
      keyCounter++;
    }
  });

  return elements;
};

// Parse inline formatting (bold, italics, links) within a line
const parseInlineFormatting = (
  text: string,
  COLORS: Record<string, string>,
  isUser: boolean,
  baseKey: number,
): React.ReactNode[] => {
  const parts: {
    type: "text" | "bold" | "italic" | "link";
    content: string;
    url?: string;
  }[] = [];
  let currentIndex = 0;
  let keyCounter = 0;

  // Regex to match **bold**, *italic*, [text](url), or plain URLs
  // Order matters: markdown links first, then bold, then italic, then URLs
  const regex =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*(.+?)\*\*)|(\*([^\*]+)\*)|(https?:\/\/[^\s]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > currentIndex) {
      parts.push({
        type: "text",
        content: text.slice(currentIndex, match.index),
      });
    }

    if (match[1]) {
      // Markdown link [text](url)
      parts.push({ type: "link", content: match[2], url: match[3] });
    } else if (match[4]) {
      // Bold text (**text**)
      parts.push({ type: "bold", content: match[5] });
    } else if (match[6]) {
      // Italic text (*text*)
      parts.push({ type: "italic", content: match[7] || match[6] });
    } else if (match[8]) {
      // Plain URL
      parts.push({ type: "link", content: match[8], url: match[8] });
    }

    currentIndex = regex.lastIndex;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push({ type: "text", content: text.slice(currentIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", content: text });
  }

  return parts.map((part, index) => {
    const key = `${baseKey}-${index}`;

    if (part.type === "bold") {
      return (
        <Text
          key={key}
          style={[
            styles.messageText,
            styles.boldText,
            { color: isUser ? COLORS.bgDeep : COLORS.textPrimary },
          ]}
        >
          {part.content}
        </Text>
      );
    }

    if (part.type === "italic") {
      return (
        <Text
          key={key}
          style={[
            styles.messageText,
            styles.italicText,
            { color: isUser ? COLORS.bgDeep : COLORS.textPrimary },
          ]}
        >
          {part.content}
        </Text>
      );
    }

    if (part.type === "link") {
      const url = part.url || part.content;
      return (
        <Text
          key={key}
          style={[
            styles.messageText,
            styles.linkText,
            { color: COLORS.accent },
          ]}
          onPress={() => Linking.openURL(url)}
        >
          {part.content}
        </Text>
      );
    }

    return (
      <Text
        key={key}
        style={[
          styles.messageText,
          { color: isUser ? COLORS.bgDeep : COLORS.textPrimary },
        ]}
      >
        {part.content}
      </Text>
    );
  });
};

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
  const [sendButtonHovered, setSendButtonHovered] = useState(false);
  const [sendButtonPressed, setSendButtonPressed] = useState(false);
  const [newChatHovered, setNewChatHovered] = useState(false);
  const [newChatPressed, setNewChatPressed] = useState(false);
  const [chipPressedStates, setChipPressedStates] = useState<
    Record<number, boolean>
  >({});
  const [chipHoveredStates, setChipHoveredStates] = useState<
    Record<number, boolean>
  >({});

  const scrollViewRef = useRef<ScrollView>(null);
  const typingAnim1 = useRef(new Animated.Value(0)).current;
  const typingAnim2 = useRef(new Animated.Value(0)).current;
  const typingAnim3 = useRef(new Animated.Value(0)).current;

  // Animation refs for cleanup
  const animRefs = useRef<Animated.CompositeAnimation[]>([]);

  // Start typing indicator animation
  const startTypingAnimation = useCallback(() => {
    // All dots share the same 600ms cycle using a single loop
    // Dot 1: jumps at 0ms
    // Dot 2: jumps at 300ms
    // Dot 3: jumps at 600ms
    const jumpDuration = 200;
    const totalCycle = 600;

    animRefs.current = [
      Animated.loop(
        Animated.parallel([
          // Dot 1: jumps at 0ms, waits 400ms until cycle end
          Animated.sequence([
            Animated.timing(typingAnim1, {
              toValue: 1,
              duration: jumpDuration,
              useNativeDriver: true,
            }),
            Animated.timing(typingAnim1, {
              toValue: 0,
              duration: jumpDuration,
              useNativeDriver: true,
            }),
            Animated.delay(totalCycle - 2 * jumpDuration),
          ]),
          // Dot 2: jumps at 200ms, waits 200ms until cycle end
          Animated.sequence([
            Animated.delay(jumpDuration),
            Animated.timing(typingAnim2, {
              toValue: 1,
              duration: jumpDuration,
              useNativeDriver: true,
            }),
            Animated.timing(typingAnim2, {
              toValue: 0,
              duration: jumpDuration,
              useNativeDriver: true,
            }),
            Animated.delay(totalCycle - 2 * jumpDuration - jumpDuration),
          ]),
          // Dot 3: jumps at 400ms, waits 0ms until cycle end
          Animated.sequence([
            Animated.delay(2 * jumpDuration),
            Animated.timing(typingAnim3, {
              toValue: 1,
              duration: jumpDuration,
              useNativeDriver: true,
            }),
            Animated.timing(typingAnim3, {
              toValue: 0,
              duration: jumpDuration,
              useNativeDriver: true,
            }),
            Animated.delay(totalCycle - 2 * jumpDuration - 2 * jumpDuration),
          ]),
        ]),
      ),
    ];

    animRefs.current[0].start();
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

  // API call to send message using official Google SDK
  const sendToApi = async (
    text: string,
    history: Message[],
  ): Promise<{ answer: string; matchedSections: string[] }> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      throw new Error("API key not found. Please configure GEMINI_API_KEY.");
    }

    // Initialize the Google Generative AI SDK
    const genAI = new GoogleGenerativeAI(apiKey);

    // For Gemma models, we use the model name directly
    const model = genAI.getGenerativeModel({
      model: "gemma-3-27b-it",
    });

    // Build chat history for SDK format
    // Gemma 3 doesn't support systemInstruction, so we prepend it as a user message
    const chatHistory = [
      {
        role: "user",
        parts: [
          {
            text: "You are Skedulelt Support Assistant, a helpful customer service chatbot for Skedulelt, a booking/scheduling platform operating in Trinidad & Tobago. Help users with questions about booking appointments, payments, cancellation policies, and using the platform. Keep responses concise and helpful.",
          },
        ],
      },
      ...history.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
    ];

    // Start chat session and send message
    const chat = model.startChat({
      history: chatHistory as any,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(text);
    const response = result.response;
    const answer = response.text();

    if (!answer) {
      throw new Error("Empty response from AI");
    }

    // Extract sections from the response
    const sections: string[] = [];
    const sectionPatterns = [/【(\d+)】/g, /\[([^\]]+)\]/g];

    for (const pattern of sectionPatterns) {
      let match;
      while ((match = pattern.exec(answer)) !== null) {
        if (!sections.includes(match[1])) {
          sections.push(match[1]);
        }
      }
    }

    return { answer, matchedSections: sections };
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
          <View
            style={[
              styles.avatar,
              styles.avatarBot,
              { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
            ]}
          >
            <Text style={[styles.avatarText, { color: COLORS.bgDeep }]}>S</Text>
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
              backgroundColor: COLORS.accent,
              borderColor: COLORS.accent,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: COLORS.bgDeep }]}>
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
          {isUser ? (
            <Text style={[styles.messageText, { color: COLORS.bgDeep }]}>
              {message.text}
            </Text>
          ) : (
            <View>{parseRichText(message.text, COLORS, isUser)}</View>
          )}
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
                Powered by Gemma 3
              </Text>
            </View>
          </View>
        </View>
        {/* New Chat Button */}
        <Pressable
          style={[
            styles.clearButton,
            { borderColor: COLORS.border },
            {
              transform: [
                {
                  scale: newChatHovered ? 1.05 : newChatPressed ? 0.95 : 1,
                },
              ],
            },
          ]}
          onPress={handleNewChat}
          onPressIn={() => setNewChatPressed(true)}
          onPressOut={() => setNewChatPressed(false)}
          {...(Platform.OS === "web" && {
            onMouseEnter: () => setNewChatHovered(true),
            onMouseLeave: () => setNewChatHovered(false),
          })}
        >
          <Text style={[styles.clearButtonText, { color: COLORS.textMuted }]}>
            ↺ New Chat
          </Text>
        </Pressable>
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
            {QUICK_ACTIONS.map((action, index) => {
              const isPressed = chipPressedStates[index];
              const isHovered = chipHoveredStates[index];
              const scale =
                Platform.OS === "web"
                  ? isHovered
                    ? 1.05
                    : 1
                  : isPressed
                    ? 0.95
                    : 1;
              return (
                <Pressable
                  key={index}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: COLORS.bgInput,
                      borderColor: COLORS.border,
                      transform: [{ scale }],
                    },
                  ]}
                  onPress={() => handleQuickAction(action.query)}
                  onPressIn={() =>
                    setChipPressedStates((prev) => ({ ...prev, [index]: true }))
                  }
                  onPressOut={() =>
                    setChipPressedStates((prev) => ({
                      ...prev,
                      [index]: false,
                    }))
                  }
                  {...(Platform.OS === "web" && {
                    onMouseEnter: () =>
                      setChipHoveredStates((prev) => ({
                        ...prev,
                        [index]: true,
                      })),
                    onMouseLeave: () =>
                      setChipHoveredStates((prev) => ({
                        ...prev,
                        [index]: false,
                      })),
                  })}
                >
                  <Text style={styles.chipIcon}>{action.icon}</Text>
                  <Text style={[styles.chipText, { color: COLORS.textMuted }]}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
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
            blurOnSubmit={true}
            returnKeyType="send"
          />
          <Pressable
            style={[
              styles.sendButton,
              {
                backgroundColor: COLORS.accent,
                shadowColor: COLORS.accent,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              },
              (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
              {
                transform: [
                  {
                    scale: sendButtonHovered
                      ? 1.05
                      : sendButtonPressed
                        ? 0.95
                        : 1,
                  },
                ],
              },
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
            onPressIn={() => setSendButtonPressed(true)}
            onPressOut={() => setSendButtonPressed(false)}
            {...(Platform.OS === "web" && {
              onMouseEnter: () => setSendButtonHovered(true),
              onMouseLeave: () => setSendButtonHovered(false),
            })}
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
          </Pressable>
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
  // Rich text styles
  blankLine: {
    height: 4,
  },
  textLine: {
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  listPrefix: {
    width: 20,
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    flex: 1,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  boldText: {
    fontWeight: "600",
  },
  italicText: {
    fontStyle: "italic",
  },
  linkText: {
    textDecorationLine: "underline",
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
