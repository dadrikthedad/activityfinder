// Dette "kortet" er det grå feltet rundt et element mot den sorte bakgrunnen, brukes i friends
// components/common/CardNative.tsx - React Native Card component
import React, { ReactNode } from "react";
import { View, TouchableOpacity, ViewStyle, StyleSheet } from "react-native";

interface CardNativeProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: "default" | "elevated" | "outlined";
  disabled?: boolean;
}

const CardNative = React.forwardRef<View, CardNativeProps>(
  ({ children, style, onPress, variant = "default", disabled = false }, ref) => {
    
    const getVariantStyle = () => {
      switch (variant) {
        case "elevated":
          return styles.elevated;
        case "outlined":
          return styles.outlined;
        case "default":
        default:
          return styles.default;
      }
    };

    const cardStyle = [
      styles.base,
      getVariantStyle(),
      style,
      disabled && styles.disabled,
    ];

    // If onPress is provided, use TouchableOpacity
    if (onPress) {
      return (
        <TouchableOpacity
          ref={ref}
          style={cardStyle}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={disabled ? 1 : 0.7}
        >
          {children}
        </TouchableOpacity>
      );
    }

    // Otherwise, use regular View
    return (
      <View ref={ref} style={cardStyle}>
        {children}
      </View>
    );
  }
);

CardNative.displayName = "CardNative";

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    padding: 16,
  },
  default: {
    backgroundColor: '#f9fafb', // Light gray background
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  elevated: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4, // Android shadow
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1C6B1C',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default CardNative;