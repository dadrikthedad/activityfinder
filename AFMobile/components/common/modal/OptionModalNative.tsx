// components/common/modal/OptionModalNative.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import CloseButtonNative from "../buttons/CloseButtonNative";
import ButtonNative from "../buttons/ButtonNative";
import { useModal } from "@/context/ModalContext";

interface OptionItem {
  label: string;
  value: string;
}

interface OptionModalNativeProps {
  /** Modal title */
  title: string;
  /** Array of options to display */
  options: OptionItem[];
  /** Callback when option is selected */
  onSelect: (value: string) => void;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Whether to blur the background (default: true) */
  blurBackground?: boolean;
  /** Whether modal can be dismissed by tapping backdrop (default: true) */
  dismissOnBackdrop?: boolean;
  /** Whether to show modal automatically when component mounts */
  autoShow?: boolean;
}

export default function OptionModalNative({
  title,
  options,
  onSelect,
  onClose,
  blurBackground = true,
  dismissOnBackdrop = true,
  autoShow = true,
}: OptionModalNativeProps) {
  const { showModal, hideModal } = useModal();

  // Automatisk visning av modal når komponenten mountes
  useEffect(() => {
    if (autoShow) {
      // Bruk setTimeout for å unngå blikning ved første render
      const timer = setTimeout(() => {
        showModal(
          <OptionModalContent 
            title={title}
            options={options}
            onSelect={onSelect}
            onClose={() => {
              hideModal();
              onClose?.();
            }}
          />,
          {
            blurBackground,
            dismissOnBackdrop,
            type: 'center'
          }
        );
      }, 50); // Kort delay for å la komponenten fullføre første render

      return () => clearTimeout(timer);
    }
  }, [autoShow, title, options]);

  const handleOptionSelect = (value: string) => {
    hideModal();
    
    setTimeout(() => {
      onSelect(value);
      onClose?.();
    }, 100);
  };

  // Siden denne komponenten automatisk viser modalen, returner null
  return null;

  function OptionModalContent({ 
    title, 
    options,
    onSelect,
    onClose 
  }: { 
    title: string; 
    options: OptionItem[];
    onSelect: (value: string) => void;
    onClose: () => void; 
  }) {
    // Kalkuler dynamisk minHeight basert på antall options
    const dynamicMinHeight = Math.max(200, 100 + (options.length * 60)); // Base høyde + plass for hver option
    const needsScrolling = options.length > 6; // Juster denne verdien etter behov
    
    return (
      <View style={[
        styles.modalContainer,
        !needsScrolling && { minHeight: dynamicMinHeight }
      ]}>
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

          {needsScrolling ? (
            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <View key={option.value} style={styles.optionWrapper}>
                  <ButtonNative
                    text={option.label}
                    onPress={() => handleOptionSelect(option.value)}
                    variant="primary"
                    size="large"
                    fullWidth
                    style={styles.optionButton}
                    textStyle={styles.optionButtonText}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.optionsContainer}>
              {options.map((option) => (
                <View key={option.value} style={styles.optionWrapper}>
                  <ButtonNative
                    text={option.label}
                    onPress={() => handleOptionSelect(option.value)}
                    variant="primary"
                    size="large"
                    fullWidth
                    style={styles.optionButton}
                    textStyle={styles.optionButtonText}
                  />
                </View>
              ))}
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
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
    flexShrink: 1, // La innholdet krympe hvis nødvendig
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
    padding: 20,
    paddingTop: 10,
  },

  optionsContainer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 20, // Sørg for god padding i bunnen
  },
  
  optionWrapper: {
    marginBottom: 12,
  },
  
  optionButton: {
    // ButtonNative håndterer sin egen styling
  },
  
  optionButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
});