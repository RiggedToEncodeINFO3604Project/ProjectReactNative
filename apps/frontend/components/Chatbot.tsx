import { IconSymbol } from "@/components/ui/icon-symbol";
import { ExtendedColours, SharedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { publicEnv } from "@/config/publicEnv";
import { extractChatbotErrorMessage } from "@/utils/chatbotError";
import Constants from "expo-constants";
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

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  sections?: string[];
}

interface QuickAction {
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  query: string;
}

interface Colours {
  bgDeep: string;
  bgCard: string;
  bgCardAlt: string;
  bgInput: string;
  accent: string;
  accentDim: string;
  accentSoft: string;
  accentContrast: string;
  textPrimary: string;
  textMuted: string;
  textDim: string;
  border: string;
  borderStrong: string;
  bubbleBot: string;
  bubbleUser: string;
  success: string;
}

interface TextPart {
  type: "text" | "bold" | "italic" | "link";
  content: string;
  url?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Book appointment",
    icon: "calendar",
    query: "How do I book an appointment?",
  },
  {
    label: "Payment security",
    icon: "lock.shield.fill",
    query: "Is my credit card safe?",
  },
  {
    label: "Cancel appointment",
    icon: "xmark.circle.fill",
    query: "How do I cancel my haircut?",
  },
  {
    label: "Grow my business",
    icon: "chart.line.uptrend.xyaxis",
    query: "How can I grow my business on Skedulelt?",
  },
];

const ANIMATION_CONFIG = {
  jumpDuration: 200,
  totalCycle: 600,
  welcomeFadeDuration: 300,
};

const MAX_MESSAGE_LENGTH = 1000;
const SCROLL_DELAY = 100;

const generateId = () => Math.random().toString(36).substr(2, 9);
const normalizeUrl = (value?: string | null) =>
  (value || "").trim().replace(/\/+$/, "");

const extractExpoHost = (): string | null => {
  const expoConfigHost = (Constants.expoConfig as { hostUri?: string } | null)
    ?.hostUri;
  if (expoConfigHost) {
    return expoConfigHost;
  }

  const manifest2Host = (
    Constants as typeof Constants & {
      manifest2?: {
        extra?: {
          expoGo?: {
            debuggerHost?: string;
          };
        };
      };
    }
  ).manifest2?.extra?.expoGo?.debuggerHost;

  return manifest2Host || null;
};

const rewriteLocalhostToExpoHost = (url: string): string => {
  if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
    return url;
  }

  const expoHostname = extractExpoHost()?.split(":")[0];
  if (!expoHostname) {
    return url;
  }

  return url.replace(/(localhost|127\.0\.0\.1)/, expoHostname);
};

const extractPort = (value: string): string => {
  const match = value.match(/:(\d+)(?:\/|$)/);
  return match?.[1] || "8081";
};

const isPrivateOrLocalHost = (hostname: string): boolean => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
};

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

const API_URL = (() => {
  const configuredBaseUrl = normalizeUrl(publicEnv.EXPO_PUBLIC_API_URL);
  const isLocalhostConfig =
    !configuredBaseUrl ||
    configuredBaseUrl.includes("localhost") ||
    configuredBaseUrl.includes("127.0.0.1");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (isLocalhostConfig) {
      if (configuredBaseUrl) {
        const configuredPort = extractPort(configuredBaseUrl);
        const currentHostname = window.location.hostname;
        if (isPrivateOrLocalHost(currentHostname)) {
          return `${window.location.protocol}//${currentHostname}:${configuredPort}/api/chat`;
        }
      }
      return `${window.location.origin}/api/chat`;
    }
    return `${configuredBaseUrl.replace(/\/api\/chat$/, "")}/api/chat`;
  }

  if (configuredBaseUrl) {
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/api\/chat$/, "");
    return `${rewriteLocalhostToExpoHost(normalizedBaseUrl)}/api/chat`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/chat`;
  }

  return "/api/chat";
})();

const sendToApi = async (
  text: string,
  history: Message[],
): Promise<{ answer: string; matchedSections: string[] }> => {
  const response = await fetch(API_URL, {
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
    const responseText = await response.text();
    throw new Error(
      extractChatbotErrorMessage(responseText) ||
        "Unable to reach AI assistant. Please try again.",
    );
  }

  const data = await response.json();
  return {
    answer: data.answer,
    matchedSections: data.matchedSections,
  };
};

const InlineText = React.memo(
  ({
    part,
    colours,
    isUser,
  }: {
    part: TextPart;
    colours: Colours;
    isUser: boolean;
  }) => {
    const textColor = isUser ? colours.accentContrast : colours.textPrimary;

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
              { color: isUser ? colours.accentContrast : colours.accent },
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
InlineText.displayName = "InlineText";

const RichTextLine = React.memo(
  ({
    line,
    colours,
    isUser,
  }: {
    line: string;
    colours: Colours;
    isUser: boolean;
  }) => {
    const trimmedLine = line.trim();
    const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.*)/);
    const bulletMatch = trimmedLine.match(/^([-*\u2022])\s+(.*)/);
    const parts = useMemo(
      () =>
        parseTextParts(numberedMatch?.[2] || bulletMatch?.[2] || trimmedLine),
      [numberedMatch, bulletMatch, trimmedLine],
    );

    if (!trimmedLine) {
      return <View style={styles.blankLine} />;
    }

    if (numberedMatch || bulletMatch) {
      const prefix = numberedMatch ? numberedMatch[1] + "." : bulletMatch![1];

      return (
        <View style={styles.listItem}>
          <Text
            style={[
              styles.listPrefix,
              { color: isUser ? colours.accentContrast : colours.accent },
            ]}
          >
            {prefix}
          </Text>
          <View style={styles.listContent}>
            {parts.map((part, index) => (
              <InlineText
                key={index}
                part={part}
                colours={colours}
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
          <InlineText key={index} part={part} colours={colours} isUser={isUser} />
        ))}
      </View>
    );
  },
);
RichTextLine.displayName = "RichTextLine";

const MessageBubble = React.memo(
  ({ message, colours }: { message: Message; colours: Colours }) => {
    const isUser = message.role === "user";
    const lines = useMemo(() => message.text.split("\n"), [message.text]);

    return (
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
          {
            backgroundColor: isUser ? colours.bubbleUser : colours.bubbleBot,
            borderColor: isUser ? colours.bubbleUser : colours.border,
            borderTopLeftRadius: isUser ? 18 : 6,
            borderTopRightRadius: isUser ? 6 : 18,
          },
        ]}
      >
        {isUser ? (
          <Text style={[styles.messageText, { color: colours.accentContrast }]}>
            {message.text}
          </Text>
        ) : (
          <View>
            {lines.map((line, index) => (
              <RichTextLine
                key={index}
                line={line}
                colours={colours}
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
                    color: colours.accentDim,
                    backgroundColor: colours.accentSoft,
                    borderColor: `${colours.accent}30`,
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
MessageBubble.displayName = "MessageBubble";

const TypingIndicator = React.memo(
  ({
    colours,
    anim1,
    anim2,
    anim3,
  }: {
    colours: Colours;
    anim1: Animated.Value;
    anim2: Animated.Value;
    anim3: Animated.Value;
  }) => {
    const animatedStyles = useMemo(
      () =>
        [anim1, anim2, anim3].map((anim) => ({
          backgroundColor: colours.textMuted,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            },
          ],
        })),
      [anim1, anim2, anim3, colours.textMuted],
    );

    return (
      <View style={[styles.messageRow, styles.botRow]}>
        <View
          style={[
            styles.avatar,
            styles.avatarBot,
            {
              backgroundColor: colours.accentSoft,
              borderColor: colours.accent,
            },
          ]}
        >
          <IconSymbol size={16} name="sparkles" color={colours.accent} />
        </View>
        <View
          style={[
            styles.bubble,
            styles.typingBubble,
            { backgroundColor: colours.bubbleBot, borderColor: colours.border },
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
TypingIndicator.displayName = "TypingIndicator";

export default function Chatbot() {
  const { isDarkMode, colours: themeColours, userType } = useTheme();

  const colours = useMemo<Colours>(() => {
    const extended = ExtendedColours[isDarkMode ? "dark" : "light"];

    return {
      bgDeep: extended.background,
      bgCard: extended.card,
      bgCardAlt: extended.cardAlt,
      bgInput: extended.inputBg,
      accent: themeColours.primary,
      accentDim: isDarkMode ? "#d8ba63" : themeColours.primary,
      accentSoft: isDarkMode
        ? `${themeColours.primary}22`
        : `${themeColours.primary}14`,
      accentContrast: isDarkMode ? "#0c0e12" : SharedColours.white,
      textPrimary: extended.text,
      textMuted: extended.textMuted,
      textDim: extended.textSecondary,
      border: extended.border,
      borderStrong: extended.borderAlt,
      bubbleBot: extended.cardAlt,
      bubbleUser: themeColours.primary,
      success: SharedColours.success,
    };
  }, [isDarkMode, themeColours.primary]);

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
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      } finally {
        stopTypingAnimation();
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [
      hideWelcome,
      inputText,
      isTyping,
      messages,
      scrollToBottom,
      startTypingAnimation,
      stopTypingAnimation,
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
  }, [stopTypingAnimation, welcomeOpacity]);

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
            colours={colours}
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
                backgroundColor: isUser ? colours.bubbleUser : colours.accentSoft,
                borderColor: isUser ? colours.bubbleUser : colours.accent,
              },
            ]}
          >
            {isUser ? (
              <IconSymbol
                size={16}
                name="person.fill"
                color={colours.accentContrast}
              />
            ) : (
              <IconSymbol size={16} name="sparkles" color={colours.accent} />
            )}
          </View>
          <MessageBubble message={message} colours={colours} />
        </View>
      );
    },
    [colours, typingAnim1, typingAnim2, typingAnim3],
  );

  const sendButtonScale = useMemo(
    () => (sendButtonHovered ? 1.05 : sendButtonPressed ? 0.95 : 1),
    [sendButtonHovered, sendButtonPressed],
  );

  const newChatScale = useMemo(
    () => (newChatHovered ? 1.05 : newChatPressed ? 0.95 : 1),
    [newChatHovered, newChatPressed],
  );

  const assistantSubtitle = useMemo(
    () =>
      userType === "provider"
        ? "Help with bookings, customers, availability, and policies"
        : "Help with bookings, payments, providers, and policies",
    [userType],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colours.bgDeep }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colours.bgCard,
            borderBottomColor: colours.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: colours.accentSoft,
                borderColor: colours.accent,
                shadowColor: colours.accent,
              },
            ]}
          >
            <IconSymbol size={22} name="sparkles" color={colours.accent} />
          </View>
          <View style={styles.headerTitles}>
            <Text style={[styles.headerTitle, { color: colours.textPrimary }]}>
              Skedulelt Support Assistant
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: colours.textMuted }]}
            >
              {assistantSubtitle}
            </Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: colours.success },
                ]}
              />
              <Text style={[styles.statusText, { color: colours.textMuted }]}>
                Powered by Gemma 3
              </Text>
            </View>
          </View>
        </View>
        <Pressable
          style={[
            styles.clearButton,
            {
              backgroundColor: colours.bgCardAlt,
              borderColor: colours.borderStrong,
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
          <Text style={[styles.clearButtonText, { color: colours.textPrimary }]}>
            New Chat
          </Text>
        </Pressable>
      </View>

      {!hasStarted && (
        <Animated.View
          style={[styles.welcomeContainer, { opacity: welcomeOpacity }]}
        >
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colours.bgCard,
                borderColor: colours.border,
              },
            ]}
          >
            <View
              style={[
                styles.heroBadge,
                {
                  backgroundColor: colours.accentSoft,
                  borderColor: colours.border,
                },
              ]}
            >
              <IconSymbol size={16} name="message.fill" color={colours.accent} />
              <Text style={[styles.heroBadgeText, { color: colours.accentDim }]}>
                Instant support
              </Text>
            </View>
            <Text style={[styles.welcomeTitle, { color: colours.textPrimary }]}>
              How can I help today?
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colours.textMuted }]}>
              Ask anything about bookings, payments, cancellations, or platform
              policies in Trinidad and Tobago.
            </Text>
          </View>
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
                      backgroundColor: colours.bgCard,
                      borderColor: colours.border,
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
                  <View
                    style={[
                      styles.chipIconWrap,
                      { backgroundColor: colours.accentSoft },
                    ]}
                  >
                    <IconSymbol size={16} name={action.icon} color={colours.accent} />
                  </View>
                  <Text style={[styles.chipText, { color: colours.textPrimary }]}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      )}

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
            <Text style={[styles.emptyStateText, { color: colours.textMuted }]}>
              Start a conversation...
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colours.bgCard,
            borderTopColor: colours.border,
          },
        ]}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colours.bgInput,
                borderColor: colours.borderStrong,
                color: colours.textPrimary,
              },
            ]}
            placeholder="Type your question..."
            placeholderTextColor={colours.textDim}
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
                backgroundColor: colours.bubbleUser,
                shadowColor: colours.accent,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
                transform: [{ scale: sendButtonScale }],
              },
              (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
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
                  transform: [
                    { scale: !inputText.trim() || isTyping ? 0.95 : 1 },
                  ],
                },
              ]}
            >
              <IconSymbol
                size={26}
                name="paperplane.fill"
                color={colours.accentContrast}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  headerTitles: {
    flexShrink: 1,
    gap: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  clearButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 12,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  welcomeContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 15,
    textAlign: "center",
    maxWidth: 440,
    lineHeight: 22,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 18,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBot: {
    borderWidth: 1,
  },
  avatarUser: {
    borderWidth: 1,
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleBot: {
    borderWidth: 1,
    borderTopLeftRadius: 6,
  },
  bubbleUser: {
    borderTopRightRadius: 6,
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
    fontSize: 15,
    lineHeight: 22,
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
    fontWeight: "600",
  },
  listContent: {
    flex: 1,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  boldText: {
    fontWeight: "700",
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
    gap: 6,
    marginTop: 10,
  },
  sectionBadgeText: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    fontWeight: "600",
  },
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
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
    borderRadius: 16,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 52,
    maxHeight: 140,
    lineHeight: 21,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
