// components/common/ButtonNative.tsx - Oppdatert med icon support
import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, View } from "react-native";

export interface ButtonNativeProps {
  /** Button text */
  text?: string;
  /** Press handler */
  onPress: () => void;
  /** Button variant */
  variant?: 
    | "primary"     // Green primary button
    | "secondary"   // Gray secondary button  
    | "danger"      // Red danger button
    | "outline"     // Outline button
    | "ghost"       // Text-only button
    | "dots";       // Three dots in rounded square
  /** Button size */
  size?: 
    | "small"       // 28px height
    | "medium"      // 44px height (default)
    | "large";      // 56px height
  /** Full width button */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Custom style override */
  style?: ViewStyle;
  /** Custom text style override */
  textStyle?: TextStyle;
  /** Icon component (Lucide icon) */
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Icon size */
  iconSize?: number;
}

export default function ButtonNative({
  text,
  onPress,
  variant = "primary",
  size = "medium", 
  fullWidth = false,
  disabled = false,
  loading = false,
  loadingText = "Loading...",
  style,
  textStyle,
  icon: Icon,
  iconPosition = 'left',
  iconSize = 16,
}: ButtonNativeProps) {
  
  const isDisabled = disabled || loading;
  const displayText = loading ? loadingText : text;

  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          container: isDisabled ? styles.primaryDisabled : styles.primary,
          text: styles.primaryText,
        };
      case "secondary":
        return {
          container: isDisabled ? styles.secondaryDisabled : styles.secondary,
          text: styles.secondaryText,
        };
      case "danger":
        return {
          container: isDisabled ? styles.dangerDisabled : styles.danger,
          text: styles.dangerText,
        };
      case "outline":
        return {
          container: isDisabled ? styles.outlineDisabled : styles.outline,
          text: isDisabled ? styles.outlineTextDisabled : styles.outlineText,
        };
      case "ghost":
        return {
          container: styles.ghost,
          text: isDisabled ? styles.ghostTextDisabled : styles.ghostText,
        };
      case "dots":
        return {
          container: isDisabled ? styles.dotsDisabled : styles.dots,
          text: styles.dotsText,
        };
      default:
        return {
          container: styles.primary,
          text: styles.primaryText,
        };
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    if (variant === "dots") {
      // Dots variant is always square and small
      switch (size) {
        case "small":
          return { width: 28, height: 28, paddingHorizontal: 0, fontSize: 14 };
        case "large":
          return { width: 40, height: 40, paddingHorizontal: 0, fontSize: 18 };
        case "medium":
        default:
          return { width: 32, height: 32, paddingHorizontal: 0, fontSize: 16 };
      }
    }
    
    switch (size) {
      case "small":
        return { height: 32, paddingHorizontal: 16, fontSize: 14 };
      case "large":
        return { height: 56, paddingHorizontal: 24, fontSize: 18 };
      case "medium":
      default:
        return { height: 44, paddingHorizontal: 20, fontSize: 16 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle = StyleSheet.flatten([
    styles.base,
    variantStyles.container,
    {
      height: sizeStyles.height,
      ...(variant === "dots" ? { width: sizeStyles.width } : { paddingHorizontal: sizeStyles.paddingHorizontal }),
      ...(fullWidth && variant !== "dots" ? { width: '100%' as const } : { alignSelf: 'flex-start' as const }),
    },
    style,
  ]);

  const textStyles = StyleSheet.flatten([
    variantStyles.text,
    { fontSize: sizeStyles.fontSize },
    textStyle,
  ]);

  const iconColor = variantStyles.text.color;

  // Render dots for dots variant
  if (variant === "dots") {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, isDisabled && styles.dotDisabled]} />
          <View style={[styles.dot, isDisabled && styles.dotDisabled]} />
          <View style={[styles.dot, isDisabled && styles.dotDisabled]} />
        </View>
      </TouchableOpacity>
    );
  }

  // OPPDATERT: Ny return med icon support
  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      {/* Wrapper for content with icon */}
      <View style={styles.contentContainer}>
        {/* Left icon */}
        {Icon && iconPosition === 'left' && (
          <Icon size={iconSize} color={iconColor} />
        )}
        
        {/* Text */}
        {displayText && (
          <Text style={textStyles}>{displayText}</Text>
        )}
        
        {/* Right icon */}
        {Icon && iconPosition === 'right' && (
          <Icon size={iconSize} color={iconColor} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  
  // NYTT: Content container for icon + text layout
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // Primary variant (Green)
  primary: {
    backgroundColor: '#1C6B1C',
  },
  primaryDisabled: {
    backgroundColor: '#144B14',
  },
  primaryText: {
    color: 'white',
    fontWeight: '600',
  },

  // Secondary variant (Gray)
  secondary: {
    backgroundColor: '#6b7280',
  },
  secondaryDisabled: {
    backgroundColor: '#d1d5db',
  },
  secondaryText: {
    color: 'white',
    fontWeight: '600',
  },

  // Danger variant (Red)
  danger: {
    backgroundColor: '#9CA3AF',
  },
  dangerDisabled: {
    backgroundColor: '#2E2E2E',
  },
  dangerText: {
    color: 'white',
    fontWeight: '600',
  },

  // Outline variant
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1C6B1C',
  },
  outlineDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  outlineText: {
    color: '#1C6B1C',
    fontWeight: '600',
  },
  outlineTextDisabled: {
    color: '#9ca3af',
    fontWeight: '600',
  },

  // Ghost variant (text only)
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: '#1C6B1C',
    fontWeight: '600',
  },
  ghostTextDisabled: {
    color: '#9ca3af',
    fontWeight: '600',
  },

  // Dots variant
  dots: {
    backgroundColor: '#1C6B1C',
    borderRadius: 6,
    minWidth: 0, // Override base minWidth
  },
  dotsDisabled: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    minWidth: 0,
  },
  dotsText: {
    color: 'white',
  },
  
  // Dots styling
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '60%', // Takes up 60% of button width
    backgroundColor: '#1C6B1C',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#ffffffff',
  },
  dotDisabled: {
    backgroundColor: '#d1d5db',
  },
});