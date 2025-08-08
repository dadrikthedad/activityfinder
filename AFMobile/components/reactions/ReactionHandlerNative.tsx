// ReactionHandlerNative.tsx - Forbedret versjon
import React, { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Vibration,
} from 'react-native';
import { ReactionDTO, MessageDTO } from '@shared/types/MessageDTO';
import { useReactions } from '@/hooks/reactions/useReactions';
import { useChatStore } from '@/store/useChatStore';
import { ReactionMenuNative } from './ReactionMenuNative';

interface ReactionHandlerNativeProps {
  targetId: number;
  userId: number;
  existingReactions: ReactionDTO[];
  children: React.ReactNode;
  disabled?: boolean;
  message?: MessageDTO;
  onReply?: (message: MessageDTO) => void;
  currentUserId?: number;
  onDelete?: (message: MessageDTO) => void;
}

export const ReactionHandlerNative: React.FC<ReactionHandlerNativeProps> = ({
  userId,
  existingReactions,
  children,
  disabled,
  message,
  onReply,
  currentUserId,
  onDelete,
}) => {
  const { addReaction } = useReactions();
  const [showMenu, setShowMenu] = useState(false);
  const getActualMessageId = useChatStore((state) => state.getActualMessageId);

  // 🔧 Sjekk om meldingen kan håndteres (har enten vanlig ID eller optimistisk ID)
  const canHandleMessage = useMemo(() => {
    if (!message) return false;
    
    // Vanlig melding - kan alltid håndteres
    if (!message.isOptimistic) return true;
    
    // Optimistisk melding - kan håndteres hvis den har optimistisk ID
    return Boolean(message.optimisticId);
  }, [message?.id, message?.isOptimistic, message?.optimisticId]);

  // 🔧 Sjekk om vi kan utføre handlinger (krever server ID)
  const actualMessageId = useMemo(() => {
    if (!message) return null;
    return getActualMessageId(message);
  }, [message?.id, message?.optimisticId, getActualMessageId]);

  const canPerformActions = useMemo(() => {
    return actualMessageId !== null;
  }, [actualMessageId]);

  const handleLongPress = () => {
    if (disabled || message?.isDeleted) return;

    // 🔧 Kan vise meny hvis vi kan håndtere meldingen (selv optimistiske)
    if (!canHandleMessage) {
      console.log("❌ Cannot handle message - no ID available");
      return;
    }
 
    // Light haptic feedback
    Vibration.vibrate(50);
    setShowMenu(true);
  };

  const handleAddReaction = (emoji: string) => {
    if (!message) {
      console.warn("⚠️ No message for reaction");
      return;
    }

    // 🔧 Krever server ID for å utføre reaksjon
    if (!canPerformActions) {
      console.warn(`⚠️ Cannot react to message - no server ID available yet`);
      
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      setShowMenu(false);
      return;
    }

    const messageId = actualMessageId;
    
    console.log(`💖 Adding reaction "${emoji}" to message:`, {
      originalId: message.id,
      actualId: messageId,
      isOptimistic: message.isOptimistic,
      optimisticId: message.optimisticId
    });
 
    addReaction({
      messageId: messageId!,
      emoji
    });
    setShowMenu(false);
  };

  const handleReply = () => {
    if (!message || !onReply) return;

    // 🔧 Reply krever også server ID
    if (!canPerformActions) {
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      setShowMenu(false);
      return;
    }

    onReply(message);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (!message || !onDelete) return;

    // 🔧 Delete kan fungere på optimistiske meldinger også
    // fordi vi sletter lokalt først
    if (!canHandleMessage) {
      console.warn("❌ Cannot delete message - no ID available");
      return;
    }

    onDelete(message);
    setShowMenu(false);
  };

  const getQuickActions = () => {
    const actions = [];
   
    // Reply action (for other people's messages)
    // 🔧 Vis reply-knappen, men den vil vise warning hvis ikke klar
    if (message && onReply && currentUserId !== message.sender?.id) {
      actions.push({
        type: 'reply' as const,
        label: 'Reply',
        onPress: handleReply,
        // 🔧 Vis visuell indikator hvis ikke klar enda
        disabled: !canPerformActions,
      });
    }
   
    // Delete action (for own messages)  
    if (message && onDelete && currentUserId === message.sender?.id && !message.isDeleted) {
      actions.push({
        type: 'delete' as const,
        label: 'Delete',
        onPress: handleDelete,
        // Delete er alltid tilgjengelig for egne meldinger
        disabled: false,
      });
    }
   
    return actions;
  };

  // 🔧 Hvis vi ikke kan håndtere meldingen i det hele tatt, ikke vis long press
  if (!canHandleMessage) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.95}
      >
        {children}
      </TouchableOpacity>
     
      <ReactionMenuNative
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onReactionSelect={handleAddReaction}
        quickActions={getQuickActions()}
        existingReactions={existingReactions}
        userId={userId}
        message={message}
        actualMessageId={actualMessageId}
        // 🔧 Legg til flag for å vise at noen handlinger ikke er klare enda
        actionsDisabled={!canPerformActions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});