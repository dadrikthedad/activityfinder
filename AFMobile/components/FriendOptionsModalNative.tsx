// DropdownNavButtonNative.tsx - React Native version
// Dropdown til ved besøk av en bruker, gir en meny med feks block, ignore osv.
import React, { useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  StyleSheet, 
  Pressable,
  Alert
} from "react-native";
import ButtonNative from "./common/buttons/ButtonNative";
import CloseButtonNative from "./common/buttons/CloseButtonNative";

interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean; // For red/warning actions
}

interface DropdownNavButtonNativeProps {
  text: string;
  actions: Action[];
  isFriend?: boolean;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
}

export default function FriendOptionsModalNative({
  text,
  actions,
  isFriend = false,
  variant = "outline",
  size = "small",
  disabled = false
}: DropdownNavButtonNativeProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleToggle = () => {
    setModalVisible(!modalVisible);
  };

  const handleClose = () => {
    setModalVisible(false);
  };

  const handleActionClick = (action: Action) => {
    if (action.disabled) return;
    
    handleClose();
    
    // Small delay to ensure modal closes before action
    setTimeout(() => {
      action.onClick();
    }, 100);
  };

  const combinedActions: Action[] = [
    ...actions,
    ...(isFriend
      ? [{ 
          label: "Remove as Friend", 
          onClick: () => Alert.alert("Friend removed"),
          destructive: true 
        }]
      : []),
  ];

  return (
    <View>
      {/* Trigger Button */}
      <ButtonNative
        onPress={handleToggle}
        variant="dots"
        size="small" // eller "medium" for litt større
        disabled={disabled}
      />

      {/* Modal with Action Sheet */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleClose}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={handleClose}
        >
          <View style={styles.modalContainer}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.actionSheet}>
                {/* Header with Close Button */}
                <View style={styles.header}>
                  <Text style={styles.headerText}>Options</Text>
                  <CloseButtonNative
                    onPress={handleClose}
                    theme="dark"
                    size={32}
                    iconSize={16}
                    style={styles.closeButton}
                  />
                </View>

                {/* Actions */}
                <View style={styles.actionsContainer}>
                  {combinedActions.map((action, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.actionButton,
                        action.disabled && styles.actionButtonDisabled,
                        idx === combinedActions.length - 1 && styles.lastActionButton
                      ]}
                      onPress={() => handleActionClick(action)}
                      disabled={action.disabled}
                    >
                      <Text 
                        style={[
                          styles.actionText,
                          action.destructive && styles.destructiveText,
                          action.disabled && styles.disabledText
                        ]}
                      >
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  modalContainer: {
    justifyContent: 'flex-end',
  },
  
  actionSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40, // Safe area padding
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    position: 'relative',
  },
  
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  
  actionsContainer: {
    paddingHorizontal: 0,
  },
  
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'center',
  },
  
  lastActionButton: {
    borderBottomWidth: 0,
  },
  
  actionButtonDisabled: {
    opacity: 0.5,
  },
  
  actionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  
  destructiveText: {
    color: '#dc2626', // Red color for destructive actions
  },
  
  disabledText: {
    color: '#9ca3af',
  },
});