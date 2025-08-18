// components/common/CloseButtonNative.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

interface CloseButtonNativeProps {
  onPress: () => void;
  theme?: 'light' | 'dark';
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
  disabled?: boolean;
}

export default function CloseButtonNative({
  onPress,
  theme = 'dark',
  size = 44,
  iconSize = 20,
  style,
  disabled = false
}: CloseButtonNativeProps) {
  const isDark = theme === 'dark';
  
  // Dynamic colors based on theme
  const iconColor = isDark ? 'white' : '#ffffff';
  const buttonBackgroundColor = isDark ? '#1C6B1C' : '#1C6B1C';
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: buttonBackgroundColor,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <X size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});