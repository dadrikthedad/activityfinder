// ActionSheetModalNative.tsx - Gjenbrukbar action sheet modal med ModalContext
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import ButtonNative from "../buttons/ButtonNative";
import { useModal } from "@/context/ModalContext";

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
}

interface TriggerConfig {
  type: "dots" | "button";
  text?: string; // For button type
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost" | "dots";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  disabled?: boolean;
}

interface ActionSheetModalNativeProps {
  /** Modal title */
  title: string;
  /** Array of actions to display */
  actions: Action[];
  /** Trigger button configuration */
  trigger: TriggerConfig;
  /** Optional custom trigger component */
  customTrigger?: React.ReactElement<{ onPress?: () => void }>;
  /** Whether to blur the background (default: true) */
  blurBackground?: boolean;
}

export default function ActionSheetModalNative({
  title,
  actions,
  trigger,
  customTrigger,
  blurBackground = true
}: ActionSheetModalNativeProps) {
  const { showModal, hideModal } = useModal();

  const handleToggle = () => {
    showModal(
      <ActionSheetContent 
        title={title}
        actions={actions}
        onClose={hideModal}
      />,
      {
        blurBackground: blurBackground, // Bruk prop-en i stedet for hardkodet true
        dismissOnBackdrop: true,
        type: 'bottom'
      }
    );
  };

  const handleActionPress = (action: Action) => {
    if (action.disabled) return;
    
    hideModal();
    
    // Small delay to ensure modal closes before action
    setTimeout(() => {
      action.onPress();
    }, 100);
  };

  const renderTrigger = () => {
    if (customTrigger) {
      return React.cloneElement(
        customTrigger as React.ReactElement<{ onPress?: () => void }>, 
        {
          onPress: handleToggle
        }
      );
    }

    if (trigger.type === "dots") {
      return (
        <ButtonNative
          onPress={handleToggle}
          variant="dots"
          size={trigger.size || "small"}
          disabled={trigger.disabled}
        />
      );
    }

    return (
      <ButtonNative
        text={trigger.text || "Options"}
        onPress={handleToggle}
        variant={trigger.variant || "primary"}
        size={trigger.size || "medium"}
        fullWidth={trigger.fullWidth}
        disabled={trigger.disabled}
      />
    );
  };

  // Action Sheet Content Component
  const ActionSheetContent = ({ 
    title, 
    actions, 
    onClose 
  }: { 
    title: string; 
    actions: Action[]; 
    onClose: () => void; 
  }) => (
    <View style={styles.actionSheet}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left spacer for centering */}
        <View style={styles.headerSpacer} />
        
        {/* Centered content */}
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        
        {/* Right side with close button */}
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        {actions.map((action, idx) => (
          <ButtonNative
            key={idx}
            text={action.label}
            onPress={() => handleActionPress(action)}
            variant={action.variant || "primary"}
            fullWidth
            disabled={action.disabled}
            style={styles.actionButton}
          />
        ))}
      </View>
      
      {/* Safe area padding at bottom */}
      <View style={styles.safeAreaBottom} />
    </View>
  );

  return renderTrigger();
}

const styles = StyleSheet.create({
  actionSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    minHeight: 200,
    width: '100%',
    // Forhindre flickering med absolut posisjonering
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#1C6B1C'
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  headerSpacer: {
    width: 40,
  },
  
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C6B1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  closeButtonText: {
    fontSize: 18,
    color: '#ffffffff',
    fontWeight: '600',
  },
  
  actionButtonsContainer: {
    gap: 12,
  },
  
  actionButton: {
    marginBottom: 0,
  },
  
  safeAreaBottom: {
    height: 34, // Standard safe area height for bottom
  },
});
