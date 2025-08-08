// components/reactions/ReactionMenuNative.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
// Import emoji picker
import EmojiSelector from 'react-native-emoji-selector';
import { ReactionDTO } from '@shared/types/MessageDTO';
import { MessageDTO } from '@shared/types/MessageDTO';

interface QuickAction {
  type: 'reply' | 'delete';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface ReactionMenuNativeProps {
  visible: boolean;
  onClose: () => void;
  onReactionSelect: (emoji: string) => void;
  quickActions: QuickAction[];
  existingReactions: ReactionDTO[];
  userId: number;
  message?: MessageDTO;
  actualMessageId?: number | null; // 🆕 NEW: Pre-calculated actual message ID
  actionsDisabled?: boolean;
}

const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

export const ReactionMenuNative: React.FC<ReactionMenuNativeProps> = ({
  visible,
  onClose,
  onReactionSelect,
  quickActions,
  existingReactions,
  userId,
  message,
  actualMessageId, 
  actionsDisabled = false,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // 🔧 FIX: Use cached actualMessageId instead of calling getActualMessageId
  const getReactionStatus = (emoji: string) => {
    if (!message || actualMessageId === null) return false;
    
    return existingReactions.some(
      (r) => r.emoji === emoji && r.userId === userId && r.messageId === actualMessageId
    );
  };

  const handleEmojiPress = (emoji: string) => {
    if (actionsDisabled) {
      return; // Ikke gjør noe hvis disabled
    }

    onReactionSelect(emoji);
  };

  const handleEmojiPickerSelect = (emoji: any) => {
    // emoji-selector returns emoji as string
    if (actionsDisabled) {
      return;
    }

    onReactionSelect(emoji);
    setShowEmojiPicker(false);
  };

  
  const renderQuickEmojis = () => (
    <View style={styles.emojiGrid}>
      {quickEmojis.map((emoji) => {
        const isActive = getReactionStatus(emoji);
        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.emojiButton, 
              isActive && styles.activeEmoji,
              actionsDisabled && styles.emojiButtonDisabled // 🔧 Disabled style
            ]}
            onPress={() => handleEmojiPress(emoji)}
            disabled={actionsDisabled} // 🔧 Disable touch
          >
            <Text style={[
              styles.emojiText,
              actionsDisabled && styles.emojiTextDisabled // 🔧 Grayed out
            ]}>
              {emoji}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.menuContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {showEmojiPicker ? 'Choose emoji' : 'React to message'}
              {actionsDisabled && ' (sending...)'}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                if (showEmojiPicker) {
                  setShowEmojiPicker(false);
                } else {
                  onClose();
                }
              }} 
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>
                {showEmojiPicker ? '←' : '✕'}
              </Text>
            </TouchableOpacity>
          </View>

          {showEmojiPicker ? (
            /* Full Emoji Picker */
            <View style={styles.emojiPickerContainer}>
              <EmojiSelector
                onEmojiSelected={handleEmojiPickerSelect}
                showTabs={true}
                showSearchBar={true}
                showSectionTitles={true}
                category={undefined}
                columns={8}
                placeholder="Search emoji..."
                theme="#1C6B1C"
              />
            </View>
          ) : (
            /* Quick Menu */
            <ScrollView style={styles.content}>
              {/* Quick Actions */}
              {quickActions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Actions</Text>
                  {quickActions.map((action) => (
                    <TouchableOpacity
                      key={action.type}
                      style={[
                        styles.actionButton,
                        action.type === 'delete' && styles.deleteAction,
                        action.disabled && styles.actionButtonDisabled // 🔧 Disabled style
                      ]}
                      onPress={action.onPress}
                      disabled={action.disabled} // 🔧 Disable touch
                    >
                      <Text style={[
                        styles.actionText,
                        action.type === 'delete' && styles.deleteText,
                        action.disabled && styles.actionTextDisabled // 🔧 Disabled text
                      ]}>
                        {action.type === 'reply' ? '↩️' : '🗑️'} {action.label}
                        {action.disabled && ' (wait...)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Quick Emojis */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Quick reactions
                  {actionsDisabled && ' (wait for message to send)'}
                </Text>
                {renderQuickEmojis()}
              </View>

              {/* More Emojis Button */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={[
                    styles.moreButton,
                    actionsDisabled && styles.moreButtonDisabled // 🔧 Disabled style
                  ]}
                  onPress={() => {
                    if (!actionsDisabled) {
                      setShowEmojiPicker(true);
                    }
                  }}
                  disabled={actionsDisabled} // 🔧 Disable touch
                >
                  <Text style={[
                    styles.moreButtonText,
                    actionsDisabled && styles.moreButtonTextDisabled // 🔧 Disabled text
                  ]}>
                    {actionsDisabled ? 'Please wait...' : 'More emojis 😊'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ... alle eksisterende styles ...
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  // 🔧 Nye disabled styles
  actionButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionTextDisabled: {
    color: '#9CA3AF',
  },
  deleteAction: {
    backgroundColor: '#FEF2F2',
  },
  actionText: {
    fontSize: 16,
    color: '#374151',
  },
  deleteText: {
    color: '#DC2626',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // 🔧 Nye emoji disabled styles
  emojiButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  emojiTextDisabled: {
    opacity: 0.4,
  },
  activeEmoji: {
    backgroundColor: '#1C6B1C',
    borderColor: '#16A34A',
    transform: [{ scale: 1.1 }],
  },
  emojiText: {
    fontSize: 24,
  },
  moreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1C6B1C',
    alignItems: 'center',
    marginBottom: 12,
  },
  // 🔧 Nye more button disabled styles
  moreButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  moreButtonTextDisabled: {
    color: '#F3F4F6',
  },
  moreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  emojiPickerContainer: {
    flex: 1,
    height: Dimensions.get('window').height * 0.6,
    backgroundColor: 'white',
  },
});