// components/common/FormFieldNative.tsx
import React from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardTypeOptions,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

interface FormFieldNativeProps {
  id: string;
  label: string;
  type?: "text" | "email" | "phone" | "number";
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  style?: any;
}

export default function FormFieldNative({
  id,
  label,
  type = "text",
  value,
  onChangeText,
  onBlur,
  error,
  touched,
  placeholder,
  disabled = false,
  autoCapitalize = "sentences",
  autoCorrect = true,
  keyboardType,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  style,
}: FormFieldNativeProps) {
  // useUnistyles gir tilgang til aktivt tema og runtime
  const { theme } = useUnistyles();

  const showError = touched && !!error;

  const getKeyboardType = (): KeyboardTypeOptions => {
    if (keyboardType) return keyboardType;
    switch (type) {
      case "email":  return "email-address";
      case "phone":  return "phone-pad";
      case "number": return "numeric";
      default:       return "default";
    }
  };

  const getAutoCapitalize = () => (type === "email" ? "none" : autoCapitalize);
  const getAutoCorrect    = () => (type === "email" ? false  : autoCorrect);

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        editable={!disabled}
        style={[
          styles.input,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.backgroundInput,
            color: theme.colors.textPrimary,
          },
          multiline  && styles.multilineInput,
          showError  && { borderColor: theme.colors.borderError, borderWidth: 2 },
          disabled   && {
            backgroundColor: theme.colors.disabled,
            color: theme.colors.disabledText,
          },
        ]}
        keyboardType={getKeyboardType()}
        autoCapitalize={getAutoCapitalize()}
        autoCorrect={getAutoCorrect()}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        maxLength={maxLength}
        placeholderTextColor={theme.colors.textPlaceholder}
        selectionColor={theme.colors.primary}
      />
      {showError && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
      )}
    </View>
  );
}

// Statiske styles — tema-farger settes inline via useUnistyles()
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
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  multilineInput: {
    height: 96,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
});
