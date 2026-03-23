// components/common/PasswordFieldNative.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

interface PasswordFieldNativeProps {
  id: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  disabled?: boolean;
  style?: any;
}

export default function PasswordFieldNative({
  id,
  label,
  value,
  onChangeText,
  onBlur,
  error,
  touched,
  placeholder,
  disabled = false,
  style,
}: PasswordFieldNativeProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { theme } = useUnistyles();

  const showError = touched && !!error;

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          editable={!disabled}
          secureTextEntry={!showPassword}
          style={[
            styles.input,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.backgroundInput,
              color: theme.colors.textPrimary,
            },
            showError && { borderColor: theme.colors.borderError, borderWidth: 2 },
            disabled  && {
              backgroundColor: theme.colors.disabled,
              color: theme.colors.disabledText,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={theme.colors.textPlaceholder}
          selectionColor={theme.colors.primary}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(p => !p)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          {showPassword ? (
            <EyeOff size={20} color={disabled ? theme.colors.disabledText : theme.colors.textMuted} />
          ) : (
            <Eye size={20} color={disabled ? theme.colors.disabledText : theme.colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
      {showError && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 6,
    textAlign: "center",
  },
  inputContainer: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 16,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    width: 24,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
    textAlign: "center",
  },
});
