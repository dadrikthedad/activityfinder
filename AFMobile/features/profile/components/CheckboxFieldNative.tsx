import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useUnistyles } from "react-native-unistyles";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function CheckboxFieldNative({
  label,
  checked,
  onChange,
  disabled = false,
}: CheckboxFieldProps) {
  const { theme } = useUnistyles();

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        opacity: disabled ? 0.6 : 1,
      }}
      onPress={() => { if (!disabled) onChange(!checked); }}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: theme.radii.sm,
          borderWidth: 2,
          borderColor: checked ? theme.colors.primary : theme.colors.border,
          backgroundColor: checked ? theme.colors.primary : theme.colors.backgroundInput,
          marginRight: theme.spacing.sm,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontSize: 14,
              fontWeight: theme.typography.bold,
              lineHeight: 16,
            }}
          >
            ✓
          </Text>
        )}
      </View>

      <Text
        style={{
          fontSize: theme.typography.md,
          color: disabled ? theme.colors.textDisabled : theme.colors.textPrimary,
          flex: 1,
          lineHeight: 24,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
