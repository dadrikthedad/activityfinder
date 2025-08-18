import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { FieldName, validateSingleField } from "@shared/utils/validators";
import ButtonNative from "../common/buttons/ButtonNative";

interface EditableFieldProps {
  name: FieldName;
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  multiline?: boolean;
  maxLength?: number;
}

export default function EditableFieldNative({ 
  name, 
  label, 
  value, 
  onSave,
  placeholder,
  keyboardType = "default",
  multiline = false,
  maxLength
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const validationError = validateSingleField(name, inputValue);
    if (validationError) {
      setError(validationError);
      Alert.alert("Validation Error", validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(inputValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
      setError(null);
    } catch (err) {
      console.error("❌ Save failed:", err);
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value);
    setEditing(false);
    setError(null);
  };

  // Update inputValue when value prop changes (from parent)
  React.useEffect(() => {
    if (!editing) {
      setInputValue(value);
    }
  }, [value, editing]);

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label}>{label}</Text>
      
      {/* Value or Input */}
      <View style={styles.valueContainer}>
        {editing ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                error ? styles.inputError : styles.inputNormal,
                multiline && styles.inputMultiline
              ]}
              value={inputValue}
              onChangeText={(text) => {
                setInputValue(text);
                setError(null);
              }}
              placeholder={placeholder || `Enter ${label.toLowerCase()}`}
              placeholderTextColor="#999999"
              keyboardType={keyboardType}
              multiline={multiline}
              maxLength={maxLength}
              editable={!isSaving}
              autoFocus={true}
              selectTextOnFocus={true}
            />
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>
        ) : (
          <View style={styles.displayValueContainer}>
            <Text style={styles.displayValue}>
              {value || "Not set"}
            </Text>
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        {saved ? (
          <ButtonNative
            text="✓ Saved"
            onPress={() => {}} // No action needed
            variant="primary"
            size="small"
            disabled={true}
          />
        ) : editing ? (
          <View style={styles.editingButtons}>
            <ButtonNative
              text={isSaving ? "Saving..." : "Save"}
              onPress={handleSave}
              variant="primary"
              size="small"
              loading={isSaving}
              disabled={isSaving}
            />
            <ButtonNative
              text="Cancel"
              onPress={handleCancel}
              variant="secondary"
              size="small"
              disabled={isSaving}
            />
          </View>
        ) : (
          <ButtonNative
            text="Edit"
            onPress={() => setEditing(true)}
            variant="primary"
            size="small"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  valueContainer: {
    marginBottom: 12,
  },
  
  displayValueContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 44,
    justifyContent: 'center',
  },
  
  displayValue: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  
  inputContainer: {
    width: '100%',
  },
  
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
    textAlign: 'center',
    minHeight: 44,
  },
  
  inputNormal: {
    borderColor: '#d1d5db',
  },
  
  inputError: {
    borderColor: '#ef4444',
  },
  
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 80,
    textAlign: 'left',
  },
  
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  
  buttonsContainer: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
},
  editingButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});