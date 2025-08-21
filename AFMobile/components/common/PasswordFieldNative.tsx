// components/common/PasswordFieldNative.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

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

  const showError = touched && !!error;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
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
            showError && styles.inputError,
            disabled && styles.inputDisabled,
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor="#9ca3af"
          selectionColor="#1C6B1C"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={togglePasswordVisibility}
          disabled={disabled}
          activeOpacity={0.7}
        >
          {showPassword ? (
            <EyeOff size={20} color={disabled ? "#d1d5db" : "#6b7280"} />
          ) : (
            <Eye size={20} color={disabled ? "#d1d5db" : "#6b7280"} />
          )}
        </TouchableOpacity>
      </View>
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
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 48, // Make room for eye icon
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#111827",
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
  eyeButton: {
    position: "absolute",
    right: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    width: 24,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
    textAlign: "center",
  },
});