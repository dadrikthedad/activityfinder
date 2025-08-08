// Først: Installer pakken
// npm install rn-emoji-keyboard
// eller
// yarn add rn-emoji-keyboard

// components/reactions/ReactionMenuNative.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Clipboard,
  Alert,
} from 'react-native';
import EmojiPicker, { type EmojiType } from 'rn-emoji-keyboard'; // Ny import
import { ReactionDTO, MessageDTO } from '@shared/types/MessageDTO';
import { 
  Heart, 
  ThumbsUp, 
  Smile, 
  Frown, 
  Laugh,
  Flame,
  PartyPopper,
  Reply,
  Trash2,
  Copy,
  Plus,
  Clipboard as ClipboardIcon
} from 'lucide-react-native';

interface QuickAction {
  type: 'reply' | 'delete' | 'copy';
  label: string;
  icon: string | React.ComponentType<any>;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface ReactionMenuNativeProps {
  visible: boolean;
  onClose: () => void;
  onReactionSelect: (emoji: string) => void;
  quickActions: QuickAction[];
  existingReactions: ReactionDTO[];
  userId: number;
  message?: MessageDTO;
  actualMessageId?: number | null;
  actionsDisabled?: boolean;
  messagePosition?: { x: number; y: number; width: number; height: number };
}

const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  messagePosition,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Erstatter showEmojiInput
  const [mainMenuClosed, setMainMenuClosed] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      // Reset states when component becomes visible
      setMainMenuClosed(false);
      setShowEmojiPicker(false);
      
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      setShowEmojiPicker(false);
      setMainMenuClosed(false);
    }
  }, [visible]);

  const getReactionStatus = (emoji: string) => {
    if (!message || actualMessageId === null) return false;
    
    return existingReactions.some(
      (r) => r.emoji === emoji && r.userId === userId && r.messageId === actualMessageId
    );
  };

  const handleEmojiPress = (emoji: string) => {
    if (actionsDisabled) return;
    onReactionSelect(emoji);
    onClose();
  };

  // Ny handler for emoji picker
  const handleEmojiSelected = (emojiObject: EmojiType) => {
    handleEmojiPress(emojiObject.emoji);
    setShowEmojiPicker(false);
    setMainMenuClosed(false);
  };

  const handleCopyMessage = () => {
    if (!message?.text) return;
    
    Clipboard.setString(message.text);
    Alert.alert('Copied', 'Message copied to clipboard');
    onClose();
  };

  // Oppdatert handler for pluss-knappen
  const handleMoreEmojiPress = () => {
    if (actionsDisabled) return;
    
    // Lukk hovedmenyen og åpne emoji picker
    setMainMenuClosed(true);
    setShowEmojiPicker(true);
  };

  const handleEmojiPickerClose = () => {
    setShowEmojiPicker(false);
    setMainMenuClosed(false);
    onClose(); // Lukk hele komponenten
  };

  const getMenuPosition = () => {
    if (!messagePosition) return { top: screenHeight / 2, left: 20 };
    
    const menuWidth = 280;
    const menuHeight = 120;
    
    // Start with position above message
    let top = messagePosition.y - menuHeight - 10;
    let left = messagePosition.x + messagePosition.width / 2 - menuWidth / 2;
    
    // Adjust if menu goes off screen vertically
    if (top < 50) {
      top = messagePosition.y + messagePosition.height + 10;
    }
    
    // Adjust if menu goes off screen horizontally
    if (left < 20) {
      left = 20;
    }
    if (left + menuWidth > screenWidth - 20) {
      left = screenWidth - menuWidth - 20;
    }
    
    return { top, left };
  };

  const renderQuickEmojis = () => (
    <View style={styles.emojiRow}>
      {quickEmojis.map((emoji) => {
        const isActive = getReactionStatus(emoji);
        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.quickEmojiButton, 
              isActive && styles.activeEmoji,
              actionsDisabled && styles.disabledButton
            ]}
            onPress={() => handleEmojiPress(emoji)}
            disabled={actionsDisabled}
            accessibilityRole="button"
            accessibilityLabel={`React ${emoji}`}
          >
            <Text style={styles.quickEmojiText}>{emoji}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={[styles.moreEmojiButton, actionsDisabled && styles.disabledButton]}
        onPress={handleMoreEmojiPress}
        disabled={actionsDisabled}
        accessibilityRole="button"
        accessibilityLabel="More emojis"
      >
        <Text style={styles.moreEmojiText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActions = () => {
    // Add copy action if not already present
    const actionsWithCopy = quickActions.some(a => a.type === 'copy') 
      ? quickActions 
      : [
          ...quickActions,
          {
            type: 'copy' as const,
            label: 'Copy',
            icon: ClipboardIcon,
            onPress: handleCopyMessage,
            disabled: !message?.text,
            destructive: false,   
          }
        ];

    if (actionsWithCopy.length === 0) return null;

     return (
    <View style={styles.actionsRow}>
      {actionsWithCopy.map((action) => {
        // Sjekk om icon er en komponent eller string
        const IconComponent = action.icon;
        const isComponent = typeof action.icon !== 'string';
        
        return (
          <TouchableOpacity
            key={action.type}
            style={[
              styles.actionButton,
              action.disabled && styles.disabledButton,
              action.destructive && styles.destructiveButton
            ]}
            onPress={action.onPress}
            disabled={action.disabled}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            {/* Render ikon basert på type */}
            <View style={styles.actionIconContainer}>
              {isComponent ? (
                <IconComponent 
                  size={16} 
                  color={action.disabled ? '#999' : action.destructive ? '#ffffffff' : '#1C6B1C'} 
                />
              ) : (
                 <Text style={styles.actionIcon}>{action.icon as string}</Text>
              )}
            </View>
            
            <Text style={[
              styles.actionLabel,
              action.disabled && styles.disabledText,
              action.destructive && styles.destructiveText
            ]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

  const renderFloatingMenu = () => {
    const position = getMenuPosition();
    
    return (
      <Animated.View
        style={[
          styles.floatingMenu,
          {
            top: position.top,
            left: position.left,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            width: 280,
            maxHeight: 200,
          },
        ]}
      >
        <View style={styles.floatingContent}>
          {/* Quick Reactions */}
          {renderQuickEmojis()}
          
          {/* Divider (only if we have actions) */}
          {quickActions.length > 0 && <View style={styles.divider} />}
          
          {/* Actions */}
          {renderActions()}
        </View>
      </Animated.View>
    );
  };

  if (!visible && !showEmojiPicker) return null;

  return (
    <>
      {/* Hovedmeny modal */}
      <Modal
        visible={visible && !mainMenuClosed}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {renderFloatingMenu()}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Emoji Picker */}
      <EmojiPicker
        open={showEmojiPicker}
        onClose={handleEmojiPickerClose}
        onEmojiSelected={handleEmojiSelected}
        // Tilpassinger
        enableSearchBar={true}
        enableRecentlyUsed={true}
        categoryOrder={[
          'recently_used',              // Nylig brukt først!
          'smileys_emotion',
          'people_body',
          'animals_nature',
          'food_drink',
          'activities',
          'travel_places',
          'objects',
          'symbols',
          'flags',
        ]}
        emojiSize={26}
        defaultHeight="50%"
        expandedHeight="80%"
        categoryPosition="top"
        hideHeader={true}   
        // Styling for å matche din app
        theme={{
          knob: '#1C6B1C',
          container: '#ffffff',
          header: '#ffffff',
          category: { 
            container: '#f5f5f5',
            containerActive: '#1C6B1C',
            iconActive: '#ffffff',
            icon: '#1C6B1C',
          }
        }}
        styles={{
          container: {
            borderWidth: 3,
            borderColor: '#1C6B1C',
            shadowColor: '#1C6B1C',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 8,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderBottomLeftRadius: 0,    // Eksplisitt ingen runding nederst
            borderBottomRightRadius: 0,
          },
        }}
      />
    </>
  );
};

// Eksisterende styles (uendret)
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  
  // Floating Menu Styles
  floatingMenu: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#1C6B1C',
  },
  floatingContent: {
    padding: 12,
  },
  
  // Quick Emojis
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,      // Legg til padding for å holde knappene inne
  },
  quickEmojiButton: {
    width: 32,                 // Reduser størrelse litt
    height: 32,
    borderRadius: 16,          // Oppdater for ny størrelse
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,       // Reduser margin
    flex: 1,                   // La dem dele plassen jevnt
    maxWidth: 32,              // Begrens maksimal bredde
  },
  quickEmojiText: {
    fontSize: 20,              // Reduser litt for mindre knapper
  },
  moreEmojiButton: {
    width: 32,                 // Match samme størrelse
    height: 32,
    borderRadius: 16,          // Match samme radius
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 32,              // Samme begrensning
  },
  moreEmojiText: {
    fontSize: 16,              // Reduser litt for mindre knapp
    color: '#666',
    fontWeight: '600',
  },
  activeEmoji: {
    backgroundColor: '#1C6B1C',
    transform: [{ scale: 1.15 }], // Reduser scale litt for mindre knapper
  },
  
  // Actions
  divider: {
    height: 1,
    backgroundColor: '#1C6B1C',
    marginVertical: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
   actionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 60,
    gap: 4,                    // Space mellom ikon og tekst
  },
  actionIconContainer: {
    height: 20,                // Fast høyde for konsistens
    justifyContent: 'center',
    alignItems: 'center',
  },
    actionIcon: {
    fontSize: 16,
  },
  actionLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },

  // Common Styles
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#F0F0F0',
  },
  disabledText: {
    color: '#999',
  },
  destructiveButton: {
    backgroundColor: '#9CA3AF',
  },
  destructiveText: {
    color: '#ffffffff',
  },
});