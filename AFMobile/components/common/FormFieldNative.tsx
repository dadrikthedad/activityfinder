// components/common/FormFieldNative.tsx
import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  KeyboardTypeOptions,
} from "react-native";

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
  const showError = touched && !!error;

  // Determine keyboard type based on type prop if not explicitly provided
  const getKeyboardType = (): KeyboardTypeOptions => {
    if (keyboardType) return keyboardType;
    
    switch (type) {
      case "email":
        return "email-address";
      case "phone":
        return "phone-pad";
      case "number":
        return "numeric";
      default:
        return "default";
    }
  };

  // Determine auto-capitalize based on type
  const getAutoCapitalize = () => {
    if (type === "email") return "none";
    return autoCapitalize;
  };

  // Determine auto-correct based on type
  const getAutoCorrect = () => {
    if (type === "email") return false;
    return autoCorrect;
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        editable={!disabled}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          showError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        keyboardType={getKeyboardType()}
        autoCapitalize={getAutoCapitalize()}
        autoCorrect={getAutoCorrect()}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        maxLength={maxLength}
        placeholderTextColor="#9ca3af"
        selectionColor="#1C6B1C"
      />
      {showError && <Text style={styles.errorText}>{error}</Text>}
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
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  multilineInput: {
    height: 96,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#dc2626",
    borderWidth: 2,
  },
  inputDisabled: {
    backgroundColor: "#f9fafb",
    color: "#9ca3af",
    borderColor: "#e5e7eb",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
});