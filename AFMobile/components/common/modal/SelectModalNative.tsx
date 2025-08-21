// SelectModalNative.tsx - Final fix
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
  customTrigger?: React.ReactElement<any>;
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
        type: 'center'
      }
    );
  };

  const handleOptionSelect = (value: string) => {
    hideModal();
    
    setTimeout(() => {
      onSelect(value);
    }, 100);
  };

  // FIXED: Filter out string children (whitespace) and only render React elements
  if (customTrigger) {
    const triggerProps = customTrigger.props as any;
    const validChildren = React.Children.toArray(triggerProps.children).filter(
      (child) => React.isValidElement(child)
    );

    return (
      <TouchableOpacity onPress={handleToggle}>
        <View style={triggerProps.style}>
          {validChildren}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleToggle} style={styles.defaultTrigger}>
      <Text>Open Select</Text>
    </TouchableOpacity>
  );

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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <CloseButtonNative 
              onPress={onClose}
              theme="light"
              size={32}
              iconSize={16}
            />
          </View>

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
  
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    minHeight: 300,
    maxHeight: '80%',
    width: '90%',
    minWidth: 320,
    maxWidth: 500,
    alignSelf: 'center',
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