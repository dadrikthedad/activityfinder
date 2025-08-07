// components/reactions/ReactionHandlerNative.tsx
import React, { useState } from 'react';
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

  const handleLongPress = () => {
    if (disabled || message?.isDeleted) return;
    
    // Light haptic feedback
    Vibration.vibrate(50);
    setShowMenu(true);
  };

  const handleAddReaction = (emoji: string) => {
    if (!message) {
      console.warn("⚠️ No message provided for reaction");
      return;
    }

    const actualMessageId = getActualMessageId(message);
    
    console.log(`💖 Adding reaction "${emoji}" to message:`, {
      originalId: message.id,
      actualId: actualMessageId,
      isOptimistic: message.isOptimistic,
      optimisticId: message.optimisticId
    });

    addReaction({
      messageId: actualMessageId,
      emoji
    });

    setShowMenu(false);
  };

  const handleReply = () => {
    if (message && onReply) {
      onReply(message);
      setShowMenu(false);
    }
  };

  const handleDelete = () => {
    if (message && onDelete) {
      onDelete(message);
      setShowMenu(false);
    }
  };

  const getQuickActions = () => {
    const actions = [];
    
    // Reply action (for other people's messages)
    if (message && onReply && currentUserId !== message.sender?.id) {
      actions.push({
        type: 'reply' as const,
        label: 'Reply',
        onPress: handleReply,
      });
    }
    
    // Delete action (for own messages)
    if (message && onDelete && currentUserId === message.sender?.id && !message.isDeleted) {
      actions.push({
        type: 'delete' as const,
        label: 'Delete',
        onPress: handleDelete,
      });
    }
    
    return actions;
  };

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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // ReactionHandlerNative
  container: {
    flex: 1,
  },
});