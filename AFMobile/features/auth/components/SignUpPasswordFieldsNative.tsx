// features/auth/components/SignUpPasswordFieldsNative.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";
import LabelWithTooltipNative from "@/components/common/buttons/LabelWithTooltipNative";

interface SignUpPasswordFieldNativeProps {
  id: string;
  label: string;
  tooltip?: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export default function SignUpPasswordFieldsNative({
  id, label, tooltip, value, onChangeText, onBlur, error,
  touched, placeholder, disabled = false, maxLength = 128,
}: SignUpPasswordFieldNativeProps) {
  const { theme } = useUnistyles();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const showError = touched && !!error;

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <LabelWithTooltipNative label={label} tooltip={tooltip} />
      <View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textPlaceholder}
            secureTextEntry={!isPasswordVisible}
            editable={!disabled}
            maxLength={maxLength}
            style={{
              flex: 1,
              height: 48,
              paddingHorizontal: theme.spacing.md,
              paddingRight: 50,
              borderWidth: 1,
              borderColor: showError ? theme.colors.borderError : theme.colors.border,
              borderRadius: theme.radii.md,
              backgroundColor: disabled ? theme.colors.disabled : theme.colors.backgroundInput,
              fontSize: theme.typography.md,
              color: disabled ? theme.colors.textDisabled : theme.colors.textPrimary,
            }}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
          />
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={{ position: "absolute", right: 12, padding: 4, zIndex: 1 }}
            disabled={disabled}
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off" : "eye"}
              size={20}
              color={disabled ? theme.colors.textDisabled : theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        {showError && (
          <Text style={{ color: theme.colors.error, fontSize: theme.typography.sm, marginTop: 4 }}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}
