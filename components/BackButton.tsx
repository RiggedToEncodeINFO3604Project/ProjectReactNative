import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/context/ThemeContext";
import {
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

type BackButtonProps = {
  onPress: (event: GestureResponderEvent) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export default function BackButton({
  onPress,
  label = "Back",
  style,
}: BackButtonProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
    >
      <IconSymbol name="arrow.backward" size={18} color={colors.tint} />
      <Text style={[styles.label, { color: colors.tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
});
