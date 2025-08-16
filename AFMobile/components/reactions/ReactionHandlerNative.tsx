// ReactionHandlerNative.tsx - Forbedret for optimistiske meldinger + reply på egne meldinger
import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Vibration,
  Dimensions,
} from 'react-native';
import { ReactionDTO, MessageDTO } from '@shared/types/MessageDTO';
import { useReactions } from '@/hooks/reactions/useReactions';
import { useChatStore } from '@/store/useChatStore';
import { ReactionMenuNative } from './ReactionMenuNative';
import { 
  Trash2,
  MessageCircleReply
} from 'lucide-react-native';

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
  const [messagePosition, setMessagePosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined>();
  
  const messageRef = useRef<View>(null);
  const getActualMessageId = useChatStore((state) => state.getActualMessageId);
  const optimisticToServerIdMap = useChatStore((state) => state.optimisticToServerIdMap);

  const setSearchMode = useChatStore(state => state.setSearchMode);
  

  // 🔧 FORBEDRET: Mer presis sjekk for om meldingen kan håndteres
  const canHandleMessage = useMemo(() => {
    if (!message) return false;
    
    // Hvis det er en vanlig melding (ikke optimistisk), kan vi alltid håndtere den
    if (!message.isOptimistic) return true;
    
    // Hvis det er en optimistisk melding, sjekk om vi har optimisticId
    if (message.isOptimistic && message.optimisticId) {
      return true; // Vi kan håndtere optimistiske meldinger med optimisticId
    }
    
    return false;
  }, [message?.id, message?.isOptimistic, message?.optimisticId]);

  // 🔧 FORBEDRET: Hent faktisk meldings-ID (kan være null for optimistiske meldinger uten mapping)
   const actualMessageId = useMemo(() => {
    if (!message) return null;
    return getActualMessageId(message);
  }, [message, getActualMessageId, optimisticToServerIdMap]);

  // 🆕 NY: Sjekk om meldingen har en server-ID (enten direkte eller via mapping)
  const hasServerMessageId = useMemo(() => {
    return actualMessageId !== null;
  }, [actualMessageId]);

  // 🔧 FORBEDRET: Kan vi utføre handlinger som krever server-ID?
  const canPerformServerActions = useMemo(() => {
    return hasServerMessageId;
  }, [hasServerMessageId]);

  // 🆕 NY: Kan vi utføre lokale handlinger (som sletting av optimistiske meldinger)?
  const canPerformLocalActions = useMemo(() => {
    return canHandleMessage;
  }, [canHandleMessage]);

  const handleLongPress = () => {
    if (disabled || message?.isDeleted || !canHandleMessage) return;

    // Measure message position for floating menu
    messageRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setMessagePosition({ x: pageX, y: pageY, width, height });
    });

    // Haptic feedback (platform specific)
    if (Vibration) {
      Vibration.vibrate(50);
    }
    
    setShowMenu(true);
  };

  const handleAddReaction = (emoji: string) => {
    if (!message) {
      console.warn("⚠️ No message for reaction");
      return;
    }

    // 🔧 FORBEDRET: Sjekk om vi kan legge til reaksjoner
    if (!canPerformServerActions) {
      console.warn(`⚠️ Cannot react to message - no server ID available yet`);
      
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      return;
    }

    const messageId = actualMessageId;
    
    console.log(`💖 Adding reaction "${emoji}" to message:`, {
      originalId: message.id,
      actualId: messageId,
      isOptimistic: message.isOptimistic,
      optimisticId: message.optimisticId,
      hasServerMapping: hasServerMessageId
    });
 
    addReaction({
      messageId: messageId!,
      emoji
    });
  };

  const handleReply = () => {
    if (!message || !onReply) return;

    // 🔧 FORBEDRET: Reply krever også server-ID
    if (!canPerformServerActions) {
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      return;
    }

    // Lukk menyen og utfør reply
    setSearchMode(false);
    onReply(message);
    setShowMenu(false); // Eksplisitt lukking av menyen
  };

  const handleDelete = () => {
    if (!message || !onDelete) return;

    // 🔧 FORBEDRET: Sletting kan gjøres lokalt for optimistiske meldinger
    if (!canPerformLocalActions) {
      console.warn("❌ Cannot delete message - no ID available");
      return;
    }

    // Kall onDelete direkte - MessageListNative håndterer konfirmasjonen
    onDelete(message);
  };

  const getQuickActions = () => {
    const actions = [];
   
    // 🔧 ENDRET: Reply action for ALLE meldinger (både egne og andres)
    if (message && onReply) {
      actions.push({
        type: 'reply' as const,
        label: 'Reply',
        icon: MessageCircleReply,
        onPress: handleReply,
        disabled: !canPerformServerActions, // 🔧 Bruk server actions sjekk
      });
    }
   
    // Delete action (kun for egne meldinger)  
    // 🔧 FORBEDRET: Sletting kan gjøres lokalt
    if (message && onDelete && currentUserId === message.sender?.id && !message.isDeleted) {
      actions.push({
        type: 'delete' as const,
        label: 'Delete',
        icon: Trash2,
        onPress: handleDelete,
        disabled: !canPerformLocalActions, // 🔧 Bruk lokal actions sjekk
        destructive: true,
      });
    }
   
    return actions;
  };

  if (!canHandleMessage) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        ref={messageRef}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.95}
        style={styles.touchable}
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
        reactionsDisabled={!canPerformServerActions} // 🔧 FIX: Bruk riktig prop
        actionsDisabled={false} // 🔧 FIX: Handlinger kan ha forskjellig tilgjengelighet
        messagePosition={messagePosition}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  touchable: {
    flex: 1,
  },
});