// features/auth/components/SignUpFormFieldNative.tsx
import React from "react";
import { View, Text, TextInput, TouchableOpacity, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";
import SelectModalNative from "@/components/common/modal/SelectModalNative";
import LabelWithTooltipNative from "@/components/common/buttons/LabelWithTooltipNative";

interface Option {
  label: string;
  value: string;
}

interface SignUpFormFieldNativeProps extends Omit<TextInputProps, "onChange" | "onBlur"> {
  id: string;
  label: string;
  tooltip?: string;
  type?: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  as?: "input" | "select";
  options?: Option[];
  disabled?: boolean;
}

export default function SignUpFormFieldNative({
  id, label, tooltip, type = "text", value, onChangeText, onBlur,
  error, touched, placeholder, as: fieldAs = "input", options = [],
  disabled = false, ...textInputProps
}: SignUpFormFieldNativeProps) {
  const { theme } = useUnistyles();
  const showError = touched && !!error;

  const inputStyle = {
    height: 48,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: showError ? theme.colors.borderError : theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: disabled ? theme.colors.disabled : theme.colors.backgroundInput,
    fontSize: theme.typography.md,
    color: disabled ? theme.colors.textDisabled : theme.colors.textPrimary,
  };

  const getTextInputProps = () => {
    const base = { ...textInputProps, editable: !disabled, style: inputStyle };
    switch (type) {
      case "email": return { ...base, keyboardType: "email-address" as const, autoCapitalize: "none" as const, autoCorrect: false };
      case "tel":   return { ...base, keyboardType: "phone-pad" as const };
      default:      return base;
    }
  };

  const getSelectedOptionLabel = () => {
    const selected = options.find((opt) => opt.value === value);
    return selected ? selected.label : placeholder || "Select an option";
  };

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <LabelWithTooltipNative label={label} tooltip={tooltip} />
      <View>
        {fieldAs === "select" ? (
          <SelectModalNative
            title={`Select ${label}`}
            options={options}
            selectedValue={value}
            onSelect={onChangeText}
            customTrigger={
              <TouchableOpacity
                style={{
                  ...inputStyle,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
                disabled={disabled}
              >
                <Text style={{
                  fontSize: theme.typography.md,
                  color: value
                    ? disabled ? theme.colors.textDisabled : theme.colors.textPrimary
                    : theme.colors.textPlaceholder,
                  flex: 1,
                }}>
                  {value ? getSelectedOptionLabel() : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={disabled ? theme.colors.textDisabled : theme.colors.textMuted} />
              </TouchableOpacity>
            }
          />
        ) : (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textPlaceholder}
            {...getTextInputProps()}
          />
        )}
        {showError && (
          <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm, marginTop: 4 }}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}
