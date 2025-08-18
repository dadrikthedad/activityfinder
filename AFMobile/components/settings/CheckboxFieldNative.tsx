import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function CheckboxFieldNative({ 
  label, 
  checked, 
  onChange, 
  disabled = false 
}: CheckboxFieldProps) {
  
  const handlePress = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        disabled && styles.containerDisabled
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[
        styles.checkbox,
        checked && styles.checkboxChecked,
        disabled && styles.checkboxDisabled
      ]}>
        {checked && (
          <Text style={[
            styles.checkmark,
            disabled && styles.checkmarkDisabled
          ]}>
            ✓
          </Text>
        )}
      </View>
      
      <Text style={[
        styles.label,
        disabled && styles.labelDisabled
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  
  containerDisabled: {
    opacity: 0.6,
  },
  
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  checkboxChecked: {
    backgroundColor: '#1C6B1C',
    borderColor: '#1C6B1C',
  },
  
  checkboxDisabled: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  
  checkmarkDisabled: {
    color: '#9ca3af',
  },
  
  label: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
    lineHeight: 24,
  },
  
  labelDisabled: {
    color: '#9ca3af',
  },
});