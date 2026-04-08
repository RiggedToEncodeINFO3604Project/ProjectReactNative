// =====================================================
// = ChatHeader Component                              =
// = Header for the chat/conversation screen           =
// =====================================================

import BackButton from "@/components/BackButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getExtendedColours } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "./Avatar";

interface ChatHeaderProps {
  name: string;
  avatar?: string;
  status?: string;
  onBack?: () => void;
  onSearchOpen?: () => void;
  onSearch?: (query: string) => void;
  isSearching?: boolean;
  searchQuery?: string;
  onSearchClose?: () => void;
  searchResultCount?: number;
  currentResultIndex?: number;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
}

export function ChatHeader({
  name,
  avatar,
  status,
  onBack,
  onSearchOpen,
  onSearch,
  isSearching = false,
  searchQuery = "",
  onSearchClose,
  searchResultCount = 0,
  currentResultIndex = 0,
  onNavigatePrevious,
  onNavigateNext,
}: ChatHeaderProps) {
  const { isDarkMode, colours: theme } = useTheme();
  const extendedColours = getExtendedColours(isDarkMode);
  const isOnline = status?.toLowerCase() === "online";
  const hasSearchQuery = searchQuery.trim().length > 0;

  if (isSearching) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            borderBottomColor: extendedColours.borderAlt,
          },
        ]}
      >
        {/* Search Input */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: isDarkMode ? extendedColours.cardAlt : extendedColours.background },
          ]}
        >
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={theme.icon}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search received messages..."
            placeholderTextColor={theme.icon}
            value={searchQuery}
            onChangeText={onSearch}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => onSearch?.("")}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={20}
                color={theme.icon}
              />
            </Pressable>
          )}
        </View>

        {/* Search Navigation */}
        {(searchResultCount > 0 || hasSearchQuery) && (
          <View style={styles.navigationContainer}>
            {searchResultCount > 0 ? (
              <>
                <Pressable
                  onPress={onNavigatePrevious}
                  style={styles.navButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="chevron.up" size={20} color={theme.text} />
                </Pressable>
                <Text style={[styles.resultCounter, { color: theme.text }]}>
                  {currentResultIndex + 1} of {searchResultCount}
                </Text>
                <Pressable
                  onPress={onNavigateNext}
                  style={styles.navButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="chevron.down" size={20} color={theme.text} />
                </Pressable>
              </>
            ) : (
              <Text style={[styles.resultCounter, { color: theme.icon }]}>
                No matches
              </Text>
            )}
          </View>
        )}

        {/* Close Search */}
        <Pressable
          onPress={onSearchClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.closeButtonText, { color: theme.tint }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderBottomColor: extendedColours.borderAlt,
        },
      ]}
    >
      {/* Left section - Back button & Avatar */}
      <View style={styles.leftSection}>
        {onBack && (
          <BackButton onPress={onBack} style={styles.backButton} />
        )}

        <Avatar uri={avatar} name={name} size="small" online={isOnline} />
      </View>

      {/* Center section - Name & Status */}
      <View style={styles.centerSection}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>
        {status && (
          <Text
            style={[
              styles.status,
              { color: theme.icon },
              isOnline && styles.onlineStatus,
            ]}
          >
            {status}
          </Text>
        )}
      </View>

      {/* Right section - Actions */}
      <View style={styles.rightSection}>
        {onSearch && (
          <Pressable
            onPress={() => {
              if (onSearchOpen) {
                onSearchOpen();
                return;
              }

              onSearch("");
            }}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="magnifyingglass" size={22} color={theme.icon} />
          </Pressable>
        )}

        {/* Options menu (three dots) - placeholder */}
        <Pressable
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.threeDots}>
            <View style={[styles.dot, { backgroundColor: theme.icon }]} />
            <View style={[styles.dot, { backgroundColor: theme.icon }]} />
            <View style={[styles.dot, { backgroundColor: theme.icon }]} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 8,
  },
  centerSection: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
  },
  status: {
    fontSize: 13,
    marginTop: 2,
  },
  onlineStatus: {
    color: "#28a745",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  threeDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // Search styles
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  navButton: {
    padding: 6,
  },
  resultCounter: {
    fontSize: 13,
    fontWeight: "500",
    minWidth: 50,
    textAlign: "center",
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});

export default ChatHeader;
