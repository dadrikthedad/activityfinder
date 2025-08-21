// components/common/FormFieldAdvancedNative.tsx
// Advanced version with tooltip and searchable select support for signup forms
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SelectModalNative from "@/components/common/modal/SelectModalNative";
import LabelWithTooltipNative from "../common/buttons/LabelWithTooltipNative";

interface Option {
  label: string;
  value: string;
}

interface SignUpFormFieldNativeProps extends Omit<TextInputProps, 'onChange' | 'onBlur'> {
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
  id,
  label,
  tooltip,
  type = "text",
  value,
  onChangeText,
  onBlur,
  error,
  touched,
  placeholder,
  as = "input",
  options = [],
  disabled = false,
  ...textInputProps
}: SignUpFormFieldNativeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const showError = touched && !!error;

  // Handle different input types
  const getTextInputProps = () => {
    const baseProps = {
      ...textInputProps,
      editable: !disabled,
      style: [
        styles.input,
        showError && styles.inputError,
        disabled && styles.inputDisabled,
      ],
    };

    switch (type) {
      case "email":
        return {
          ...baseProps,
          keyboardType: "email-address" as const,
          autoCapitalize: "none" as const,
          autoCorrect: false,
        };
      case "tel":
        return {
          ...baseProps,
          keyboardType: "phone-pad" as const,
        };
      case "date":
        return {
          ...baseProps,
          placeholder: "YYYY-MM-DD",
        };
      default:
        return baseProps;
    }
  };

  const handleSelectOption = (selectedValue: string) => {
    onChangeText(selectedValue);
  };

  const getSelectedOptionLabel = () => {
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder || "Select an option";
  };

  return (
    <View style={styles.container}>
      {/* Label and Tooltip */}
      <LabelWithTooltipNative label={label} tooltip={tooltip} />

      {/* Input or Select */}
      <View style={styles.inputContainer}>
        {as === "select" ? (
          <SelectModalNative
            title={`Select ${label}`}
            options={options}
            selectedValue={value}
            onSelect={handleSelectOption}
            customTrigger={
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  showError && styles.inputError,
                  disabled && styles.inputDisabled,
                ]}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.selectText,
                    !value && styles.placeholderText,
                    disabled && styles.disabledText,
                  ]}
                >
                  {value ? getSelectedOptionLabel() : placeholder}
                </Text>
                <Ionicons 
                  name="chevron-down" 
                  size={20} 
                  color={disabled ? "#9ca3af" : "#6b7280"} 
                />
              </TouchableOpacity>
            }
          />
        ) : (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            {...getTextInputProps()}
          />
        )}

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
  input: {
    height: 48,
    paddingHorizontal: 16,
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
  selectButton: {
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  placeholderText: {
    color: "#9ca3af",
  },
  disabledText: {
    color: "#9ca3af",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 4,
  },
});