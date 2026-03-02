// =====================================================
// = ChatHeader Component                              =
// = Header for the chat/conversation screen           =
// =====================================================

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "./Avatar";

interface ChatHeaderProps {
  name: string;
  avatar?: string;
  status?: string;
  onBack?: () => void;
  onSearch?: (query: string) => void;
  isSearching?: boolean;
  searchQuery?: string;
  onSearchClose?: () => void;
  searchResultCount?: number;
  currentResultIndex?: number;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
}

const PRIMARY_COLOR = "#0a7ea4";

export function ChatHeader({
  name,
  avatar,
  status,
  onBack,
  onSearch,
  isSearching = false,
  searchQuery = "",
  onSearchClose,
  searchResultCount = 0,
  currentResultIndex = 0,
  onNavigatePrevious,
  onNavigateNext,
}: ChatHeaderProps) {
  const isOnline = status?.toLowerCase() === "online";

  if (isSearching) {
    return (
      <View style={styles.container}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={Colors.light.icon}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={Colors.light.icon}
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
                color={Colors.light.icon}
              />
            </Pressable>
          )}
        </View>

        {/* Search Navigation */}
        {searchResultCount > 0 && (
          <View style={styles.navigationContainer}>
            <Pressable
              onPress={onNavigatePrevious}
              style={styles.navButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol
                name="chevron.up"
                size={20}
                color={Colors.light.text}
              />
            </Pressable>
            <Text style={styles.resultCounter}>
              {currentResultIndex + 1} of {searchResultCount}
            </Text>
            <Pressable
              onPress={onNavigateNext}
              style={styles.navButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol
                name="chevron.down"
                size={20}
                color={Colors.light.text}
              />
            </Pressable>
          </View>
        )}

        {/* Close Search */}
        <Pressable
          onPress={onSearchClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Left section - Back button & Avatar */}
      <View style={styles.leftSection}>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol
              name="chevron.left.forwardslash.chevron.right"
              size={24}
              color={Colors.light.text}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </Pressable>
        )}

        <Avatar uri={avatar} name={name} size="small" online={isOnline} />
      </View>

      {/* Center section - Name & Status */}
      <View style={styles.centerSection}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {status && (
          <Text style={[styles.status, isOnline && styles.onlineStatus]}>
            {status}
          </Text>
        )}
      </View>

      {/* Right section - Actions */}
      <View style={styles.rightSection}>
        {onSearch && (
          <Pressable
            onPress={() => onSearch("")}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol
              name="magnifyingglass"
              size={22}
              color={Colors.light.icon}
            />
          </Pressable>
        )}

        {/* Options menu (three dots) - placeholder */}
        <Pressable
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.threeDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
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
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    minHeight: 60,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  centerSection: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.text,
  },
  status: {
    fontSize: 13,
    color: Colors.light.icon,
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
    backgroundColor: Colors.light.icon,
  },
  // Search styles
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
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
    color: Colors.light.text,
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
    color: Colors.light.text,
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
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
});

export default ChatHeader;
