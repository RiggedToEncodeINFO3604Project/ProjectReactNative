import { View, type ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColour } from '@/hooks/use-theme-colour';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function ThemedView({ style, lightColor, darkColor, edges = [], ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColour({ light: lightColor, dark: darkColor }, 'background');
  const insets = useSafeAreaInsets();

  const edgeStyles = StyleSheet.create({
    top: { paddingTop: insets.top },
    bottom: { paddingBottom: insets.bottom },
    left: { paddingLeft: insets.left },
    right: { paddingRight: insets.right },
  });

  const paddingStyle = edges.reduce((acc, edge) => ({
    ...acc,
    ...edgeStyles[edge],
  }), {});

  return <View style={[{ backgroundColor, ...paddingStyle }, style]} {...otherProps} />;
}
