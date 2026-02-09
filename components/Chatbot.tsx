import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";
import Constants from "expo-constants";

// Get API key from environment (supports both .env and app.json extra)
const getApiKey = (): string => {
  if (typeof process !== "undefined" && process.env) {
    const envKey =
      (process.env as Record<string, string>).EXPO_PUBLIC_GEMINI_API_KEY ||
      (process.env as Record<string, string>).GEMINI_API_KEY;
    if (envKey) return envKey;
  }

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

interface Colors {
  bgDeep: string;
  bgCard: string;
  bgInput: string;
  accent: string;
  accentDim: string;
  textPrimary: string;
  textMuted: string;
  textDim: string;
  border: string;
  bubbleBot: string;
}

interface TextPart {
  type: "text" | "bold" | "italic" | "link";
  content: string;
  url?: string;
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

// Constants
const ANIMATION_CONFIG = {
  jumpDuration: 200,
  totalCycle: 600,
  welcomeFadeDuration: 300,
};

const MAX_MESSAGE_LENGTH = 1000;
const SCROLL_DELAY = 100;

// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9);

// Optimized text parsing for UI rendering
const parseTextParts = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let currentIndex = 0;

  const regex =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*(.+?)\*\*)|(\*([^\*]+)\*)|(https?:\/\/[^\s]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push({
        type: "text",
        content: text.slice(currentIndex, match.index),
      });
    }

    if (match[1]) {
      parts.push({ type: "link", content: match[2], url: match[3] });
    } else if (match[4]) {
      parts.push({ type: "bold", content: match[5] });
    } else if (match[6]) {
      parts.push({ type: "italic", content: match[7] || match[6] });
    } else if (match[8]) {
      parts.push({ type: "link", content: match[8], url: match[8] });
    }

    currentIndex = regex.lastIndex;
  }

  if (currentIndex < text.length) {
    parts.push({ type: "text", content: text.slice(currentIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", content: text });
  }

  return parts;
};

// API service - calls backend API endpoint securely
const sendToApi = async (
  text: string,
  history: Message[],
): Promise<{ answer: string; matchedSections: string[] }> => {
  const response = await fetch("https://render-app.onrender.com/api/chat", {
    // To be replaced with actual API endpoint
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      history: history.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        text: m.text,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  return {
    answer: data.answer,
    matchedSections: data.matchedSections,
  };
};

// Memoized components
const InlineText = React.memo(
  ({
    part,
    colors,
    isUser,
  }: {
    part: TextPart;
    colors: Colors;
    isUser: boolean;
  }) => {
    const textColor = isUser ? colors.bgDeep : colors.textPrimary;

    const handleLinkPress = useCallback(() => {
      if (part.url) {
        Linking.openURL(part.url);
      }
    }, [part.url]);

    switch (part.type) {
      case "bold":
        return (
          <Text
            style={[styles.messageText, styles.boldText, { color: textColor }]}
          >
            {part.content}
          </Text>
        );
      case "italic":
        return (
          <Text
            style={[
              styles.messageText,
              styles.italicText,
              { color: textColor },
            ]}
          >
            {part.content}
          </Text>
        );
      case "link":
        return (
          <Text
            style={[
              styles.messageText,
              styles.linkText,
              { color: colors.accent },
            ]}
            onPress={handleLinkPress}
          >
            {part.content}
          </Text>
        );
      default:
        return (
          <Text style={[styles.messageText, { color: textColor }]}>
            {part.content}
          </Text>
        );
    }
  },
);

const RichTextLine = React.memo(
  ({
    line,
    colors,
    isUser,
  }: {
    line: string;
    colors: Colors;
    isUser: boolean;
  }) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return <View style={styles.blankLine} />;
    }

    const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.*)/);
    const bulletMatch = trimmedLine.match(/^([-*•])\s+(.*)/);

    const parts = useMemo(
      () =>
        parseTextParts(numberedMatch?.[2] || bulletMatch?.[2] || trimmedLine),
      [numberedMatch, bulletMatch, trimmedLine],
    );

    if (numberedMatch || bulletMatch) {
      const prefix = numberedMatch ? numberedMatch[1] + "." : bulletMatch![1];

      return (
        <View style={styles.listItem}>
          <Text style={[styles.listPrefix, { color: colors.accent }]}>
            {prefix}
          </Text>
          <View style={styles.listContent}>
            {parts.map((part, index) => (
              <InlineText
                key={index}
                part={part}
                colors={colors}
                isUser={isUser}
              />
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.textLine}>
        {parts.map((part, index) => (
          <InlineText key={index} part={part} colors={colors} isUser={isUser} />
        ))}
      </View>
    );
  },
);

const MessageBubble = React.memo(
  ({ message, colors }: { message: Message; colors: Colors }) => {
    const isUser = message.role === "user";
    const lines = useMemo(() => message.text.split("\n"), [message.text]);

    return (
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
          {
            backgroundColor: isUser ? colors.accent : colors.bubbleBot,
            borderColor: colors.border,
            borderTopLeftRadius: isUser ? 14 : 4,
            borderTopRightRadius: isUser ? 4 : 14,
          },
        ]}
      >
        {isUser ? (
          <Text style={[styles.messageText, { color: colors.bgDeep }]}>
            {message.text}
          </Text>
        ) : (
          <View>
            {lines.map((line, index) => (
              <RichTextLine
                key={index}
                line={line}
                colors={colors}
                isUser={isUser}
              />
            ))}
          </View>
        )}
        {!isUser && message.sections && message.sections.length > 0 && (
          <View style={styles.sectionsBadge}>
            {message.sections.map((section, index) => (
              <Text
                key={index}
                style={[
                  styles.sectionBadgeText,
                  {
                    color: colors.accentDim,
                    backgroundColor: `${colors.accent}20`,
                    borderColor: `${colors.accent}30`,
                  },
                ]}
              >
                {section}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  },
);

const TypingIndicator = React.memo(
  ({
    colors,
    anim1,
    anim2,
    anim3,
  }: {
    colors: Colors;
    anim1: Animated.Value;
    anim2: Animated.Value;
    anim3: Animated.Value;
  }) => {
    const animatedStyles = useMemo(
      () =>
        [anim1, anim2, anim3].map((anim) => ({
          backgroundColor: colors.textMuted,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            },
          ],
        })),
      [anim1, anim2, anim3, colors.textMuted],
    );

    return (
      <View style={[styles.messageRow, styles.botRow]}>
        <View
          style={[
            styles.avatar,
            styles.avatarBot,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.bgDeep }]}>S</Text>
        </View>
        <View
          style={[
            styles.bubble,
            styles.typingBubble,
            { backgroundColor: colors.bubbleBot, borderColor: colors.border },
          ]}
        >
          <View style={styles.typingDots}>
            {animatedStyles.map((style, index) => (
              <Animated.View key={index} style={[styles.dot, style]} />
            ))}
          </View>
        </View>
      </View>
    );
  },
);

export default function Chatbot() {
  const { isDarkMode } = useTheme();

  const COLORS = useMemo<Colors>(
    () =>
      isDarkMode
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
          },
    [isDarkMode],
  );

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
  const animRefs = useRef<Animated.CompositeAnimation[]>([]);

  const startTypingAnimation = useCallback(() => {
    const { jumpDuration, totalCycle } = ANIMATION_CONFIG;

    const createDotAnimation = (
      anim: Animated.Value,
      delay: number,
    ): Animated.CompositeAnimation =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: jumpDuration,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: jumpDuration,
          useNativeDriver: true,
        }),
        Animated.delay(totalCycle - 2 * jumpDuration - delay),
      ]);

    animRefs.current = [
      Animated.loop(
        Animated.parallel([
          createDotAnimation(typingAnim1, 0),
          createDotAnimation(typingAnim2, jumpDuration),
          createDotAnimation(typingAnim3, 2 * jumpDuration),
        ]),
      ),
    ];

    animRefs.current[0].start();
  }, [typingAnim1, typingAnim2, typingAnim3]);

  const stopTypingAnimation = useCallback(() => {
    animRefs.current.forEach((anim) => anim.stop());
    animRefs.current = [];
    typingAnim1.setValue(0);
    typingAnim2.setValue(0);
    typingAnim3.setValue(0);
  }, [typingAnim1, typingAnim2, typingAnim3]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, SCROLL_DELAY);
  }, []);

  const hideWelcome = useCallback(() => {
    Animated.timing(welcomeOpacity, {
      toValue: 0,
      duration: ANIMATION_CONFIG.welcomeFadeDuration,
      useNativeDriver: true,
    }).start(() => {
      setHasStarted(true);
    });
  }, [welcomeOpacity]);

  const handleSendMessage = useCallback(
    async (text?: string) => {
      const messageText = text?.trim() || inputText.trim();
      if (!messageText || isTyping) return;

      Keyboard.dismiss();
      hideWelcome();

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        text: messageText,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setIsTyping(true);
      scrollToBottom();

      setMessages((prev) => [...prev, { id: "typing", role: "bot", text: "" }]);
      startTypingAnimation();

      try {
        const history = messages.filter((m) => m.id !== "typing");
        const data = await sendToApi(messageText, history);

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "typing"),
          {
            id: generateId(),
            role: "bot",
            text: data.answer,
            sections: data.matchedSections,
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "typing"),
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

  const handleQuickAction = useCallback(
    (query: string) => {
      handleSendMessage(query);
    },
    [handleSendMessage],
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setHasStarted(false);
    setInputText("");
    welcomeOpacity.setValue(1);
    stopTypingAnimation();
    setIsTyping(false);
  }, [welcomeOpacity, stopTypingAnimation]);

  useEffect(() => {
    return () => {
      stopTypingAnimation();
    };
  }, [stopTypingAnimation]);

  const renderMessage = useCallback(
    (message: Message) => {
      const isUser = message.role === "user";

      if (message.id === "typing") {
        return (
          <TypingIndicator
            key={message.id}
            colors={COLORS}
            anim1={typingAnim1}
            anim2={typingAnim2}
            anim3={typingAnim3}
          />
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
          <MessageBubble message={message} colors={COLORS} />
        </View>
      );
    },
    [COLORS, typingAnim1, typingAnim2, typingAnim3],
  );

  const sendButtonScale = useMemo(
    () => (sendButtonHovered ? 1.05 : sendButtonPressed ? 0.95 : 1),
    [sendButtonHovered, sendButtonPressed],
  );

  const newChatScale = useMemo(
    () => (newChatHovered ? 1.05 : newChatPressed ? 0.95 : 1),
    [newChatHovered, newChatPressed],
  );

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
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: COLORS.accent,
                shadowColor: COLORS.accent,
              },
            ]}
          >
            <Text style={[styles.logoText, { color: COLORS.bgDeep }]}>S</Text>
          </View>
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
        <Pressable
          style={[
            styles.clearButton,
            {
              borderColor: COLORS.border,
              transform: [{ scale: newChatScale }],
            },
          ]}
          onPress={handleNewChat}
          onPressIn={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setNewChatPressed(true);
          }}
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

      {/* Welcome Screen */}
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
                  onPressIn={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setChipPressedStates((prev) => ({
                      ...prev,
                      [index]: true,
                    }));
                  }}
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
            maxLength={MAX_MESSAGE_LENGTH}
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
              { transform: [{ scale: sendButtonScale }] },
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
            onPressIn={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSendButtonPressed(true);
            }}
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
    paddingBottom: Platform.OS === "ios" ? 80 : 60,
  },
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
    shadowOpacity: 0.28,
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
});
