import { useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type PressableProps,
} from "react-native";

interface AnimatedButtonProps {
  title: string;
  onPress?: () => void;
  style?: View["props"]["style"];
  textStyle?: Text["props"]["style"];
  buttonColor?: string;
  textColor?: string;
}

export default function AnimatedButton({
  title,
  onPress,
  style,
  textStyle,
  buttonColor = "#f0c85a",
  textColor = "#0c0e12",
}: AnimatedButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isWeb = Platform.OS === "web";

  // Animation values
  const scale = isWeb ? (isHovered ? 1.05 : 1) : isPressed ? 0.95 : 1;

  const pressableProps: PressableProps = {
    onPress,
    onPressIn: () => setIsPressed(true),
    onPressOut: () => setIsPressed(false),
    style: [
      styles.button,
      { backgroundColor: buttonColor, transform: [{ scale }] },
      style,
    ],
    android_ripple: !isWeb ? { color: "rgba(0,0,0,0.2)" } : undefined,
  };

  // Add web hover events (type assertion needed for web-only events)
  if (isWeb) {
    (
      pressableProps as PressableProps & { onMouseEnter?: () => void }
    ).onMouseEnter = () => setIsHovered(true);
    (
      pressableProps as PressableProps & { onMouseLeave?: () => void }
    ).onMouseLeave = () => setIsHovered(false);
  }

  return (
    <Pressable {...pressableProps}>
      <View>
        <Text style={[styles.buttonText, { color: textColor }, textStyle]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#f0c85a",
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f0c85a",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.5,
    elevation: 8,
  },
  buttonText: {
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "400",
    color: "#0c0e12",
    letterSpacing: 1,
    textAlign: "center",
  },
});
