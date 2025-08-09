// ReactionMenuNative.tsx - Forbedret for optimistiske meldinger
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Clipboard
} from 'react-native';
import EmojiPicker, { type EmojiType } from 'rn-emoji-keyboard';
import { ReactionDTO, MessageDTO } from '@shared/types/MessageDTO';
import { 
  Plus,
  Clipboard as ClipboardIcon
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChatStore } from '@/store/useChatStore';

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
  reactionsDisabled?: boolean; // 🆕 NY: Separat kontroll for reaksjoner
  actionsDisabled?: boolean;   // 🔧 FORBEDRET: Separat kontroll for handlinger
  messagePosition?: { x: number; y: number; width: number; height: number };
}

const fallbackEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥"];
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
  reactionsDisabled = false, // 🆕 NY
  actionsDisabled = false,   // 🔧 FORBEDRET
  messagePosition,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mainMenuClosed, setMainMenuClosed] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const recentEmojis = useChatStore((state) => state.recentEmojis);
  const addRecentEmoji = useChatStore((state) => state.addRecentEmoji);

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

  // 🔧 FORBEDRET: Bruk actualMessageId for å sjekke reaksjonsstatus
  const getReactionStatus = (emoji: string) => {
    if (!message || actualMessageId === null) return false;
    
    return existingReactions.some(
      (r) => r.emoji === emoji && r.userId === userId && r.messageId === actualMessageId
    );
  };

  const handleEmojiPress = (emoji: string) => {
    // 🔧 FORBEDRET: Bruk reactionsDisabled i stedet for actionsDisabled
    if (reactionsDisabled) {
      console.warn("⚠️ Reactions are disabled - message may not have server ID yet");
      return;
    }
    
    // Lagre emoji som recent i store
    addRecentEmoji(emoji);
    
    onReactionSelect(emoji);
    onClose();
  };

  // Emoji picker handler
  const handleEmojiSelected = (emojiObject: EmojiType) => {
    const emoji = emojiObject.emoji;
    
    // 🔧 FORBEDRET: Sjekk reactionsDisabled her også
    if (reactionsDisabled) {
      console.warn("⚠️ Reactions are disabled - message may not have server ID yet");
      return;
    }
    
    // Lagre emoji som recent i store
    addRecentEmoji(emoji);
    
    // Fortsett med vanlig handling
    handleEmojiPress(emoji);
    setShowEmojiPicker(false);
    setMainMenuClosed(false);
  };

  const handleCopyMessage = () => {
    if (!message?.text) return;
    
    Clipboard.setString(message.text);
    onClose();
  };

  // Handler for pluss-knappen
  const handleMoreEmojiPress = () => {
    // 🔧 FORBEDRET: Bruk reactionsDisabled
    if (reactionsDisabled) {
      console.warn("⚠️ Cannot open emoji picker - reactions are disabled");
      return;
    }
    
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

  const renderQuickEmojis = () => {
    // Kombiner recent + fallback for å alltid ha 7 emojis
    const combineEmojis = () => {
      const combined = [...recentEmojis]; // Start med recent
      
      // Legg til fallback emojis som ikke allerede finnes
      for (const fallbackEmoji of fallbackEmojis) {
        if (!combined.includes(fallbackEmoji) && combined.length < 7) {
          combined.push(fallbackEmoji);
        }
      }
      
      return combined.slice(0, 7); // Sørg for maks 7
    };
    
    const emojisToShow = combineEmojis();
    
    return (
      <View style={styles.emojiRow}>
        {emojisToShow.map((emoji, index) => {
          const isActive = getReactionStatus(emoji);
          const isRecent = index < recentEmojis.length;
          
          return (
            <TouchableOpacity
              key={`${emoji}-${index}`}
              style={[
                styles.quickEmojiButton, 
                isActive && styles.activeEmoji,
                reactionsDisabled && styles.disabledButton // 🔧 FORBEDRET
              ]}
              onPress={() => handleEmojiPress(emoji)}
              disabled={reactionsDisabled} // 🔧 FORBEDRET
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji} ${isRecent ? '(recent)' : ''}`}
            >
              <Text style={[
                styles.quickEmojiText,
                reactionsDisabled && styles.disabledEmojiText // 🆕 NY: Grå ut emoji hvis deaktivert
              ]}>
                {emoji}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[
            styles.moreEmojiButton, 
            reactionsDisabled && styles.disabledButton // 🔧 FORBEDRET
          ]}
          onPress={handleMoreEmojiPress}
          disabled={reactionsDisabled} // 🔧 FORBEDRET
          accessibilityRole="button"
          accessibilityLabel="More emojis"
        >
          <Plus 
            size={16} 
            color={reactionsDisabled ? "#999" : "#ffffffff"} // 🆕 NY: Grå ut ikon
          />
        </TouchableOpacity>
      </View>
    );
  };

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
          
          {/* 🆕 NY: Vis status hvis reaksjoner er deaktivert */}
          {reactionsDisabled && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>⏳ Waiting for message to sync...</Text>
            </View>
          )}
          
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

      {/* Emoji Picker - 🔧 FORBEDRET: Ikke vis hvis reaksjoner er deaktivert */}
      {!reactionsDisabled && (
        <EmojiPicker
          open={showEmojiPicker}
          onClose={handleEmojiPickerClose}
          onEmojiSelected={handleEmojiSelected}
          enableSearchBar={true}
          enableRecentlyUsed={true}
          categoryOrder={[
            'recently_used',
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
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            },
          }}
        />
      )}
    </>
  );
};

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
    marginBottom: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  quickEmojiButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
    flex: 1,
    maxWidth: 32,
  },
  quickEmojiText: {
    fontSize: 20,
  },
  // 🆕 NY: Grå ut emoji tekst når deaktivert
  disabledEmojiText: {
    opacity: 0.3,
  },
  moreEmojiButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C6B1C',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 32,
  },
  activeEmoji: {
    backgroundColor: '#1C6B1C',
    transform: [{ scale: 1.15 }],
  },
  
  // 🆕 NY: Status container
  statusContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  statusText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    fontStyle: 'italic',
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
    gap: 4,
  },
  actionIconContainer: {
    height: 20,
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