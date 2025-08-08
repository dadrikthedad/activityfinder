// ReactionHandlerNative.tsx - Oppdatert for best practice meny
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

  const canHandleMessage = useMemo(() => {
    if (!message) return false;
    if (!message.isOptimistic) return true;
    return Boolean(message.optimisticId);
  }, [message?.id, message?.isOptimistic, message?.optimisticId]);

  const actualMessageId = useMemo(() => {
    if (!message) return null;
    return getActualMessageId(message);
  }, [message?.id, message?.optimisticId, getActualMessageId]);

  const canPerformActions = useMemo(() => {
    return actualMessageId !== null;
  }, [actualMessageId]);

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

    if (!canPerformActions) {
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
      optimisticId: message.optimisticId
    });
 
    addReaction({
      messageId: messageId!,
      emoji
    });
  };

  const handleReply = () => {
    if (!message || !onReply) return;

    if (!canPerformActions) {
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      return;
    }

    onReply(message);
  };

  const handleDelete = () => {
    if (!message || !onDelete) return;

    if (!canHandleMessage) {
      console.warn("❌ Cannot delete message - no ID available");
      return;
    }

    // Show confirmation for destructive action
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => onDelete(message)
        }
      ]
    );
  };

  const getQuickActions = () => {
    const actions = [];
   
    // Reply action (for other people's messages)
    if (message && onReply && currentUserId !== message.sender?.id) {
      actions.push({
        type: 'reply' as const,
        label: 'Reply',
        icon: '↩️',
        onPress: handleReply,
        disabled: !canPerformActions,
      });
    }
   
    // Delete action (for own messages)  
    if (message && onDelete && currentUserId === message.sender?.id && !message.isDeleted) {
      actions.push({
        type: 'delete' as const,
        label: 'Delete',
        icon: '🗑️',
        onPress: handleDelete,
        disabled: false,
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
        actionsDisabled={!canPerformActions}
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