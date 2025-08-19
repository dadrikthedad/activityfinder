// SelectModalNative.tsx - Gjenbrukbar select modal komponent
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import CloseButtonNative from "../buttons/CloseButtonNative";
import { useModal } from "@/context/ModalContext";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectModalNativeProps {
  /** Modal title */
  title: string;
  /** Array of options to display */
  options: SelectOption[];
  /** Currently selected value */
  selectedValue: string;
  /** Callback when option is selected */
  onSelect: (value: string) => void;
  /** Optional custom trigger component */
  customTrigger?: React.ReactElement<{ onPress?: () => void }>;
  /** Whether to blur the background (default: true) */
  blurBackground?: boolean;
  /** Whether modal can be dismissed by tapping backdrop (default: true) */
  dismissOnBackdrop?: boolean;
}

export default function SelectModalNative({
  title,
  options,
  selectedValue,
  onSelect,
  customTrigger,
  blurBackground = true,
  dismissOnBackdrop = true
}: SelectModalNativeProps) {
  const { showModal, hideModal } = useModal();

  const handleToggle = () => {
    showModal(
      <SelectModalContent 
        title={title}
        options={options}
        selectedValue={selectedValue}
        onSelect={onSelect}
        onClose={hideModal}
      />,
      {
        blurBackground,
        dismissOnBackdrop,
        type: 'center' // Bruk center for select modal (ikke bottom som action sheet)
      }
    );
  };

  const handleOptionSelect = (value: string) => {
    hideModal();
    
    // Small delay to ensure modal closes before callback
    setTimeout(() => {
      onSelect(value);
    }, 100);
  };

  // Render custom trigger if provided
  if (customTrigger) {
    return React.cloneElement(
      customTrigger as React.ReactElement<{ onPress?: () => void }>, 
      {
        onPress: handleToggle
      }
    );
  }

  // Default trigger - can be customized as needed
  return (
    <TouchableOpacity onPress={handleToggle} style={styles.defaultTrigger}>
      <Text>Open Select</Text>
    </TouchableOpacity>
  );

  // Select Modal Content Component
  function SelectModalContent({ 
    title, 
    options, 
    selectedValue,
    onSelect,
    onClose 
  }: { 
    title: string; 
    options: SelectOption[];
    selectedValue: string;
    onSelect: (value: string) => void;
    onClose: () => void; 
  }) {
    return (
      <View style={styles.modalContainer}>
        <SafeAreaView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <CloseButtonNative 
              onPress={onClose}
              theme="light"
              size={32}
              iconSize={16}
            />
          </View>

          {/* Options List */}
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
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
    );
  }
}

const styles = StyleSheet.create({
  defaultTrigger: {
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  
  // Modal container
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    minHeight: 300,
    maxHeight: '80%',
    width: '90%',
    minWidth: 320, // Minimum bredde
    maxWidth: 500, // Økt maksimal bredde
    alignSelf: 'center', // Sentrer modalen
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  modalContent: {
    flex: 1,
  },
  
  // Header
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 60,
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  // Options list
  optionsList: {
    flex: 1,
    minHeight: 150,
  },
  
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 50,
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