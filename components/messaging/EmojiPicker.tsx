// =====================================================
// = EmojiPicker Component                             =
// = Custom emoji picker for React Native Expo         =
// =====================================================

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const EMOJI_SIZE = 40;
const EMOJIS_PER_ROW = Math.floor((SCREEN_WIDTH - 32) / EMOJI_SIZE);

// Emoji categories with common emojis
const EMOJI_CATEGORIES = [
  {
    id: "recent",
    name: "Recent",
    icon: "🕐",
    emojis: [],
  },
  {
    id: "smileys",
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😝",
      "😜",
      "🤪",
      "🤨",
      "🧐",
      "🤓",
      "😎",
      "🥸",
      "🤩",
      "🥳",
      "😏",
      "😒",
      "😞",
      "😔",
      "😟",
      "😕",
      "🙁",
      "☹️",
      "😣",
      "😖",
      "😫",
      "😩",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
      "🤬",
    ],
  },
  {
    id: "people",
    name: "People",
    icon: "👋",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "💪",
      "🦾",
      "🦵",
      "🦿",
      "🦶",
      "👣",
      "👂",
      "🦻",
      "👃",
      "🫀",
      "🫁",
      "🧠",
      "🦷",
      "🦴",
      "👀",
      "👁️",
      "👅",
      "👄",
      "🫦",
    ],
  },
  {
    id: "nature",
    name: "Nature",
    icon: "🐶",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🦗",
      "🕷️",
      "🕸️",
      "🦂",
      "🐢",
      "🐍",
      "🦎",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
    ],
  },
  {
    id: "food",
    name: "Food",
    icon: "🍎",
    emojis: [
      "🍏",
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🍍",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🍄",
      "🥜",
      "🫘",
      "🌰",
      "🍞",
      "🥐",
      "🥖",
      "🥨",
      "🥯",
      "🥞",
      "🧇",
      "🧀",
      "🍖",
      "🍗",
      "🥩",
      "🥓",
      "🍔",
      "🍟",
      "🍕",
      "🌭",
      "🥪",
      "🌮",
    ],
  },
  {
    id: "activities",
    name: "Activities",
    icon: "⚽",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛼",
      "🛷",
      "⛸️",
      "🥌",
      "🎿",
      "⛷️",
      "🏂",
      "🪂",
      "🏋️",
      "🤼",
      "🤸",
      "⛹️",
      "🤺",
      "🤾",
      "🌅",
      "🏇",
      "🧘",
      "🏄",
      "🏊",
      "🤽",
      "🚣",
      "🧗",
    ],
  },
  {
    id: "objects",
    name: "Objects",
    icon: "💡",
    emojis: [
      "💡",
      "🔦",
      "🏮",
      "🪔",
      "📔",
      "📕",
      "📖",
      "📗",
      "📘",
      "📙",
      "📚",
      "📓",
      "📒",
      "📃",
      "📜",
      "📄",
      "📰",
      "🗞️",
      "📑",
      "🔖",
      "🏷️",
      "💰",
      "🪙",
      "💴",
      "💵",
      "💶",
      "💷",
      "💸",
      "💳",
      "🧾",
      "💹",
      "✉️",
      "📧",
      "📨",
      "📩",
      "📤",
      "📥",
      "📦",
      "📫",
      "📪",
      "📬",
      "📭",
      "📮",
      "🗳️",
      "✏️",
      "✒️",
      "🖋️",
      "🖊️",
      "🖌️",
      "🖍️",
    ],
  },
  {
    id: "symbols",
    name: "Symbols",
    icon: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮️",
      "✝️",
      "☪️",
      "🕉️",
      "☸️",
      "✡️",
      "🔯",
      "🕎",
      "☯️",
      "☦️",
      "🛐",
      "⛎",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
      "🆔",
      "⚛️",
      "🉑",
      "☢️",
      "☣️",
      "📴",
      "📳",
    ],
  },
];

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  recentEmojis?: string[];
}

export function EmojiPicker({
  visible,
  onClose,
  onEmojiSelect,
  recentEmojis = [],
}: EmojiPickerProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [activeCategory, setActiveCategory] = useState("smileys");

  // Get emojis for the current category (including recent)
  const currentEmojis = useMemo(() => {
    if (activeCategory === "recent") {
      return recentEmojis.length > 0 ? recentEmojis : ["No recent emojis"];
    }

    const category = EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory);
    return category?.emojis || [];
  }, [activeCategory, recentEmojis]);

  // Handle emoji selection
  const handleEmojiPress = useCallback(
    (emoji: string) => {
      if (emoji !== "No recent emojis") {
        onEmojiSelect(emoji);
      }
    },
    [onEmojiSelect],
  );

  // Render individual emoji item
  const renderEmojiItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.emojiItem}
        onPress={() => handleEmojiPress(item)}
        activeOpacity={0.6}
      >
        <Text style={styles.emojiText}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleEmojiPress],
  );

  // Render category tab
  const renderCategoryTab = useCallback(
    (category: (typeof EMOJI_CATEGORIES)[0]) => (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryTab,
          activeCategory === category.id && [
            styles.categoryTabActive,
            { backgroundColor: colorScheme === "dark" ? "#333" : "#e9ecef" },
          ],
        ]}
        onPress={() => setActiveCategory(category.id)}
        activeOpacity={0.6}
      >
        <Text style={styles.categoryIcon}>{category.icon}</Text>
      </TouchableOpacity>
    ),
    [activeCategory, colorScheme],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: colorScheme === "dark" ? "#333" : "#e9ecef",
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.text }]}>Emoji</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: theme.icon }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[
              styles.categoryContainer,
              {
                borderBottomColor: colorScheme === "dark" ? "#333" : "#f0f0f0",
              },
            ]}
            contentContainerStyle={styles.categoryContent}
          >
            {EMOJI_CATEGORIES.map(renderCategoryTab)}
          </ScrollView>

          {/* Emoji Grid */}
          {activeCategory === "recent" && recentEmojis.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Text style={[styles.emptyRecentText, { color: theme.icon }]}>
                No recent emojis
              </Text>
            </View>
          ) : (
            <FlatList
              data={currentEmojis}
              renderItem={renderEmojiItem}
              keyExtractor={(item, index) => `${item}-${index}`}
              numColumns={EMOJIS_PER_ROW}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.emojiGrid}
            />
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    maxHeight: SCREEN_HEIGHT * 0.5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    shadowOpacity: 0.2,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
  },
  categoryContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
  },
  categoryContent: {
    paddingHorizontal: 8,
    gap: 4,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  categoryTabActive: {
    backgroundColor: "#e9ecef",
  },
  categoryIcon: {
    fontSize: 22,
  },
  emojiGrid: {
    padding: 8,
    paddingBottom: 24,
  },
  emojiItem: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 28,
  },
  emptyRecent: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyRecentText: {
    fontSize: 16,
  },
});

export default EmojiPicker;
