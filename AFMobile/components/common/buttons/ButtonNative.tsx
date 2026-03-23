// components/common/buttons/ButtonNative.tsx
import React from "react";
import { TouchableOpacity, Text, ViewStyle, TextStyle, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

export interface ButtonNativeProps {
  text?: string;
  onPress: () => void;
  variant?:
    | "primary"     // Primærfarge (gull i begge temaer)
    | "secondary"   // Grå sekundærknapp
    | "danger"      // Rød fareknapp
    | "outline"     // Konturknapp
    | "ghost"       // Kun tekst
    | "dots";       // Tre prikker i avrundet firkant
  size?:
    | "small"       // 32px høyde
    | "medium"      // 44px høyde (standard)
    | "large";      // 56px høyde
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconPosition?: "left" | "right";
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
  iconPosition = "left",
  iconSize = 16,
}: ButtonNativeProps) {
  const { theme } = useUnistyles();
  const isDisabled = disabled || loading;
  const displayText = loading ? loadingText : text;

  // --- Farger per variant ---

  const getColors = (): { bg: string; textColor: string; border?: string } => {
    switch (variant) {
      case "primary":
        return {
          bg:        isDisabled ? theme.colors.disabled     : theme.colors.primary,
          textColor: isDisabled ? theme.colors.disabledText : theme.colors.onPrimary,
        };
      case "secondary":
        return {
          bg:        isDisabled ? theme.colors.disabled     : theme.colors.surfaceAlt,
          textColor: isDisabled ? theme.colors.disabledText : theme.colors.textSecondary,
        };
      case "danger":
        return {
          bg:        isDisabled ? theme.colors.disabled     : theme.colors.error,
          textColor: isDisabled ? theme.colors.disabledText : "#ffffff",
        };
      case "outline":
        return {
          bg:        "transparent",
          textColor: isDisabled ? theme.colors.disabledText : theme.colors.primary,
          border:    isDisabled ? theme.colors.disabled     : theme.colors.primary,
        };
      case "ghost":
        return {
          bg:        "transparent",
          textColor: isDisabled ? theme.colors.disabledText : theme.colors.primary,
        };
      case "dots":
        return {
          bg:        isDisabled ? theme.colors.disabled     : theme.colors.surfaceAlt,
          textColor: isDisabled ? theme.colors.disabledText : theme.colors.textPrimary,
        };
    }
  };

  // --- Størrelser ---

  const getSizeStyles = () => {
    if (variant === "dots") {
      switch (size) {
        case "small":  return { width: 28, height: 28, paddingHorizontal: 0, fontSize: theme.typography.sm };
        case "large":  return { width: 40, height: 40, paddingHorizontal: 0, fontSize: theme.typography.lg };
        default:       return { width: 32, height: 32, paddingHorizontal: 0, fontSize: theme.typography.md };
      }
    }
    switch (size) {
      case "small":  return { height: 32, paddingHorizontal: 16, fontSize: theme.typography.sm };
      case "large":  return { height: 56, paddingHorizontal: 24, fontSize: theme.typography.lg };
      default:       return { height: 44, paddingHorizontal: 20, fontSize: theme.typography.md };
    }
  };

  const colors = getColors();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: variant === "dots" ? 0 : 80,
    height: sizeStyles.height,
    backgroundColor: colors.bg,
    // Border — kun outline-varianten har kant
    ...(variant === "outline" ? { borderWidth: 1, borderColor: colors.border } : {}),
    // Bredde — dots er fast, fullWidth strekker seg, resten tilpasser innhold
    ...(variant === "dots"
      ? { width: sizeStyles.width }
      : fullWidth
      ? { width: "100%" as const }
      : { paddingHorizontal: sizeStyles.paddingHorizontal, alignSelf: "flex-start" as const }),
    ...style,
  };

  const resolvedTextStyle: TextStyle = {
    fontSize: sizeStyles.fontSize,
    fontWeight: theme.typography.semibold,
    color: colors.textColor,
    ...textStyle,
  };

  // Dots-variant
  if (variant === "dots") {
    const dotColor = isDisabled ? theme.colors.disabledText : theme.colors.textMuted;
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: dotColor }} />
          ))}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        {Icon && iconPosition === "left" && (
          <Icon size={iconSize} color={colors.textColor} />
        )}
        {displayText && (
          <Text style={resolvedTextStyle}>{displayText}</Text>
        )}
        {Icon && iconPosition === "right" && (
          <Icon size={iconSize} color={colors.textColor} />
        )}
      </View>
    </TouchableOpacity>
  );
}
