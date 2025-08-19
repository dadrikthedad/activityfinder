import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { FieldName, validateSingleField } from "@shared/utils/validators";
import ButtonNative from "../common/buttons/ButtonNative";
import SelectModalNative from "../common/modal/SelectModalNative";

interface EditableSelectFieldProps {
  name: FieldName;
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSave: (newValue: string) => Promise<void>;
}

export default function EditableSelectFieldNative({
  name,
  label,
  value,
  options,
  onSave,
}: EditableSelectFieldProps) {
  const [editing, setEditing] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const validationError = validateSingleField(name, selectedValue);
    if (validationError) {
      setError(validationError);
      Alert.alert("Validation Error", validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedValue);
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
    setSelectedValue(value);
    setEditing(false);
    setError(null);
  };

  const handleOptionSelect = (optionValue: string) => {
    setSelectedValue(optionValue);
    setError(null);
  };

  // Update selectedValue when value prop changes (from parent)
  React.useEffect(() => {
    if (!editing) {
      setSelectedValue(value);
    }
  }, [value, editing]);

  // Find display label for current value
  const getDisplayLabel = (val: string) => {
    const option = options.find(opt => opt.value === val);
    return option ? option.label : val || "Not selected";
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label}>{label}</Text>
      
      {/* Value or Picker */}
      <View style={styles.valueContainer}>
        {editing ? (
          <View style={styles.selectContainer}>
            {/* Use the new SelectModalNative component */}
            <SelectModalNative
              title={`Select ${label}`}
              options={options}
              selectedValue={selectedValue}
              onSelect={handleOptionSelect}
              customTrigger={
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    error ? styles.selectButtonError : styles.selectButtonNormal
                  ]}
                  disabled={isSaving}
                >
                  <Text style={styles.selectButtonText}>
                    {getDisplayLabel(selectedValue)}
                  </Text>
                  <Text style={styles.selectButtonArrow}>▼</Text>
                </TouchableOpacity>
              }
            />
            
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>
        ) : (
          <View style={styles.displayValueContainer}>
            <Text style={styles.displayValue}>
              {getDisplayLabel(value)}
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
    flexDirection: 'row',
  },
  
  selectContainer: {
    width: '100%',
  },
  
  selectButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  selectButtonNormal: {
    borderColor: '#d1d5db',
  },
  
  selectButtonError: {
    borderColor: '#ef4444',
  },
  
  selectButtonText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  
  selectButtonArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
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