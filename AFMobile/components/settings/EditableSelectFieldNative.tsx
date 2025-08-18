import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { FieldName, validateSingleField } from "@shared/utils/validators";
import ButtonNative from "../common/buttons/ButtonNative";

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
  const [showPicker, setShowPicker] = useState(false);

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
    setShowPicker(false);
  };

  const handleOptionSelect = (optionValue: string) => {
    setSelectedValue(optionValue);
    setShowPicker(false);
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
            <TouchableOpacity
              style={[
                styles.selectButton,
                error ? styles.selectButtonError : styles.selectButtonNormal
              ]}
              onPress={() => setShowPicker(true)}
              disabled={isSaving}
            >
              <Text style={styles.selectButtonText}>
                {getDisplayLabel(selectedValue)}
              </Text>
              <Text style={styles.selectButtonArrow}>▼</Text>
            </TouchableOpacity>
            
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

      {/* Custom Picker Modal */}
      <Modal
        visible={showPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <SafeAreaView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <TouchableOpacity
                  onPress={() => setShowPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.optionsList}>
                {options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionItem,
                      selectedValue === option.value && styles.optionItemSelected
                    ]}
                    onPress={() => handleOptionSelect(option.value)}
                  >
                    <Text style={[
                      styles.optionText,
                      selectedValue === option.value && styles.optionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    {selectedValue === option.value && (
                      <Text style={styles.optionCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
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
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    maxWidth: 400,
  },
  
  modalContent: {
    flex: 1,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  modalCloseButton: {
    padding: 4,
  },
  
  modalCloseText: {
    fontSize: 18,
    color: '#6b7280',
  },
  
  optionsList: {
    flex: 1,
  },
  
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  
  optionItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  
  optionText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  
  optionTextSelected: {
    color: '#1C6B1C',
    fontWeight: '500',
  },
  
  optionCheckmark: {
    fontSize: 16,
    color: '#1C6B1C',
    fontWeight: 'bold',
  },
});