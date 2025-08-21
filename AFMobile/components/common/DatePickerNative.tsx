// components/common/DatePickerNative.tsx
// Native date picker component with proper date formatting
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from "@expo/vector-icons";
import LabelWithTooltipNative from "./buttons/LabelWithTooltipNative";
interface DatePickerNativeProps {
  id: string;
  label: string;
  tooltip?: string;
  value: string; // YYYY-MM-DD format
  onChangeText: (dateString: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  disabled?: boolean;
  maxDate?: Date;
  minDate?: Date;
}

export default function DatePickerNative({
  id,
  label,
  tooltip,
  value,
  onChangeText,
  onBlur,
  error,
  touched,
  placeholder = "Select date",
  disabled = false,
  maxDate,
  minDate,
}: DatePickerNativeProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const showError = touched && !!error;

  // Convert string to Date object
  const getDateFromString = (dateString: string): Date => {
    if (!dateString) return new Date();
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  // Convert Date to YYYY-MM-DD string
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const getDisplayDate = (): string => {
    if (!value) return placeholder;
    const date = getDateFromString(value);
    if (isNaN(date.getTime())) return placeholder;
    
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate && event.type !== 'dismissed') {
      const formattedDate = formatDateToString(selectedDate);
      onChangeText(formattedDate);
      // Don't call onBlur - no live validation for date picker
    }
  };

  const openPicker = () => {
    if (!disabled) {
      setShowPicker(true);
    }
  };

  const closePicker = () => {
    setShowPicker(false);
    // Don't call onBlur - no live validation for date picker
  };

  return (
    <View style={styles.container}>
      {/* Label and Tooltip */}
      <LabelWithTooltipNative label={label} tooltip={tooltip} />

      {/* Date Input */}
      <TouchableOpacity
        style={[
          styles.dateButton,
          // Only show error styling on submit (when touched via handleSubmitNative)
          showError && styles.dateButtonError,
          disabled && styles.dateButtonDisabled,
        ]}
        onPress={openPicker}
        disabled={disabled}
      >
        <Text
          style={[
            styles.dateText,
            !value && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {getDisplayDate()}
        </Text>
        <Ionicons 
          name="calendar" 
          size={20} 
          color={disabled ? "#9ca3af" : "#6b7280"} 
        />
      </TouchableOpacity>

      {/* Only show error on submit */}
      {showError && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* iOS Date Picker Modal */}
      {Platform.OS === 'ios' && showPicker && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={styles.modalButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={[styles.modalButton, styles.doneButton]}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={getDateFromString(value)}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={maxDate || new Date()}
                minimumDate={minDate}
                style={styles.datePicker}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android Date Picker */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={getDateFromString(value)}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={maxDate || new Date()}
          minimumDate={minDate}
        />
      )}

      {/* Tooltip Modal */}
      {tooltip && (
        <Modal
          visible={showTooltip}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTooltip(false)}
        >
          <TouchableOpacity
            style={styles.tooltipOverlay}
            onPress={() => setShowTooltip(false)}
          >
            <View style={styles.tooltipContent}>
              <Text style={styles.tooltipText}>{tooltip}</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
  tooltipButton: {
    marginLeft: 8,
    padding: 2,
  },
  dateButton: {
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
  dateButtonError: {
    borderColor: "#dc2626",
  },
  dateButtonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  dateText: {
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

  // iOS Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
  },
  modalButton: {
    fontSize: 16,
    color: "#6b7280",
  },
  doneButton: {
    color: "#1C6B1C",
    fontWeight: "600",
  },
  datePicker: {
    height: 200,
  },

  // Tooltip styles
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  tooltipContent: {
    backgroundColor: "#374151",
    padding: 16,
    borderRadius: 8,
    maxWidth: 280,
  },
  tooltipText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
  },
});