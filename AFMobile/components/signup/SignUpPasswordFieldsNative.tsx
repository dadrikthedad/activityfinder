// components/common/PasswordFieldAdvancedNative.tsx
// Advanced password field with tooltip support for signup forms
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LabelWithTooltipNative from "../common/buttons/LabelWithTooltipNative";

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
  id,
  label,
  tooltip,
  value,
  onChangeText,
  onBlur,
  error,
  touched,
  placeholder,
  disabled = false,
  maxLength = 128,
}: SignUpPasswordFieldNativeProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const showError = touched && !!error;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.container}>
      {/* Label and Tooltip */}
      <LabelWithTooltipNative label={label} tooltip={tooltip} />

      {/* Password Input Container */}
      <View style={styles.inputContainer}>
        <View style={styles.passwordInputWrapper}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            secureTextEntry={!isPasswordVisible}
            editable={!disabled}
            maxLength={maxLength}
            style={[
              styles.passwordInput,
              showError && styles.inputError,
              disabled && styles.inputDisabled,
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
          />
          
          {/* Toggle Password Visibility Button */}
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={styles.eyeButton}
            disabled={disabled}
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off" : "eye"}
              size={20}
              color={disabled ? "#9ca3af" : "#6b7280"}
            />
          </TouchableOpacity>
        </View>

        {/* Error Message */}
        {showError && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    position: "relative",
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    paddingRight: 50, // Make room for eye button
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    fontSize: 16,
    color: "#374151",
  },
  inputError: {
    borderColor: "#dc2626",
  },
  inputDisabled: {
    backgroundColor: "#f9fafb",
    color: "#9ca3af",
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 4,
  },
});