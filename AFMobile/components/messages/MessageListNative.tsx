// components/messages/MessageListNative.tsx
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { MessageDTO } from '@shared/types/MessageDTO';
import { useChatStore } from '@/store/useChatStore';
import { usePaginatedMessages } from '@/hooks/messages/getMessagesForConversation';
import { useDeleteMessage } from '@/hooks/messages/useSoftDelete';
import MessageAttachmentsNative from './MessageAttachmentsNative';
import MiniAvatarNative from '../common/MiniAvatarNative';
import { formatSentDate } from '@shared/utils/date/chatDate';
import { ReactionHandlerNative } from '../reactions/ReactionHandlerNative';

interface MessageListNativeProps {
  currentUser: UserSummaryDTO | null;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  conversationVisible: boolean;
  onScrollPositionChange?: (atBottom: boolean) => void;
  onReply?: (message: MessageDTO) => void;
  onConversationError?: (error: string | null) => void;
  onRetryMessage?: (message: MessageDTO) => void;
  onDeleteFailedMessage?: (message: MessageDTO) => void;
}

interface MessageItemProps {
  message: MessageDTO;
  currentUser: UserSummaryDTO | null;
  isLocked: boolean;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onRetry?: (message: MessageDTO) => void;
  onDeleteFailed?: (message: MessageDTO) => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
}

const MessageItemNative = React.memo(({
  message,
  currentUser,
  isLocked,
  onReply,
  onDelete,
  onRetry,
  onDeleteFailed,
  onShowUserPopover,
}: MessageItemProps) => {
  const isMine = currentUser?.id === message.sender?.id;
  const isOptimistic = message.isOptimistic;
  const hasSendError = message.sendError;

  // System message
  if (message.isSystemMessage) {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.text}</Text>
        <Text style={styles.systemMessageTime}>
          {formatSentDate(message.sentAt)}
        </Text>
      </View>
    );
  }

  const handleAvatarPress = () => {
    if (message.sender && !isMine && onShowUserPopover) {
      // For mobile, we can't get exact position, so we pass default
      onShowUserPopover(message.sender, { x: 0, y: 0 });
    }
  };

  // Get existing reactions for this message
  const existingReactions = message.reactions || [];

  // Group reactions by emoji and count them
  const groupedReactions = useMemo(() => {
    const reactionMap = new Map();
    
    existingReactions
      .filter(reaction => !reaction.isRemoved)
      .forEach(reaction => {
        const key = reaction.emoji;
        if (reactionMap.has(key)) {
          const existing = reactionMap.get(key);
          reactionMap.set(key, {
            ...existing,
            count: existing.count + 1,
            userIds: [...existing.userIds, reaction.userId]
          });
        } else {
          reactionMap.set(key, {
            emoji: reaction.emoji,
            count: 1,
            userIds: [reaction.userId]
          });
        }
      });
    
    return Array.from(reactionMap.values());
  }, [existingReactions]);

  const messageContent = (
    <View
      style={[
        styles.messageContainer,
        isMine ? styles.myMessageContainer : styles.otherMessageContainer,
        isOptimistic && hasSendError && styles.errorMessageContainer,
      ]}
    >
      {/* Avatar and sender info */}
      <View style={[styles.messageHeader, isMine && styles.myMessageHeader]}>
        {!isMine && message.sender && (
          <TouchableOpacity onPress={handleAvatarPress}>
            <MiniAvatarNative
              imageUrl={message.sender.profileImageUrl ?? "/default-avatar.png"}
              size={24}
            />
          </TouchableOpacity>
        )}
        
        <View style={[styles.senderInfo, isMine && styles.mySenderInfo]}>
          <Text style={[styles.senderName, isMine && styles.mySenderName]}>
            {isMine ? "You" : message.sender?.fullName ?? "Unknown"}
          </Text>
          <Text style={styles.messageTime}>
            {formatSentDate(message.sentAt)}
          </Text>
        </View>

        {isMine && (
          <MiniAvatarNative
            imageUrl={currentUser?.profileImageUrl ?? "/default-avatar.png"}
            size={24}
          />
        )}
      </View>

      {/* Reply preview */}
      {message.parentMessageId && (message.parentMessageText || message.parentSender) && (
        <View style={[styles.replyPreview, isMine && styles.myReplyPreview]}>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>
              Reply to {message.parentSender?.fullName ?? "Someone"}
            </Text>
            {message.parentMessageText && (
              <Text style={styles.replyText} numberOfLines={2}>
                {message.parentMessageText.length > 100 
                  ? `${message.parentMessageText.substring(0, 100)}...`
                  : message.parentMessageText
                }
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Message text */}
      {message.text && !message.isDeleted && (
        <View style={[styles.messageContent, isMine && styles.myMessageContent]}>
          <Text style={[styles.messageText, isMine && styles.myMessageText]}>
            {message.text}
          </Text>
        </View>
      )}

      {/* Deleted message */}
      {message.isDeleted && (
        <View style={styles.deletedMessageContainer}>
          <Text style={styles.deletedMessageText}>This message has been deleted</Text>
        </View>
      )}

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <View style={[styles.attachmentsContainer, isMine && styles.myAttachmentsContainer]}>
          <MessageAttachmentsNative
            attachments={message.attachments}
            isLocked={isLocked}
          />
        </View>
      )}

      {/* Error UI for failed messages */}
      {isOptimistic && hasSendError && (
        <View style={styles.errorActionsContainer}>
          <View style={styles.errorInfo}>
            <Text style={styles.errorText}>❌ {message.sendError}</Text>
          </View>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => onRetry?.(message)}
            >
              <Text style={styles.retryButtonText}>🔄 Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeleteFailed?.(message)}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sending indicator */}
      {isOptimistic && message.isSending && (
        <View style={styles.sendingIndicator}>
          <ActivityIndicator size="small" color="#6B7280" />
          <Text style={styles.sendingText}>Sending...</Text>
        </View>
      )}

      {/* Reactions display */}
      {groupedReactions.length > 0 && (
        <View style={[styles.reactionsContainer, isMine && styles.myReactionsContainer]}>
          {groupedReactions.map((reaction, index) => (
            <View key={`${reaction.emoji}-${index}`} style={styles.reactionBubble}>
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Don't wrap deleted or system messages with reaction handler
  if (message.isDeleted || isLocked || (isOptimistic && hasSendError)) {
    return messageContent;
  }

  return (
    <ReactionHandlerNative
      targetId={message.id}
      userId={currentUser?.id || 0}
      existingReactions={existingReactions}
      message={message}
      onReply={onReply}
      currentUserId={currentUser?.id}
      onDelete={onDelete}
      disabled={isLocked}
    >
      {messageContent}
    </ReactionHandlerNative>
  );
});

MessageItemNative.displayName = 'MessageItemNative';

export default function MessageListNative({
  currentUser,
  onShowUserPopover,
  conversationVisible,
  onScrollPositionChange,
  onReply,
  onConversationError,
  onRetryMessage,
  onDeleteFailedMessage,
}: MessageListNativeProps) {
  const { liveMessages, scrollPositions, setScrollPosition } = useChatStore();
  const rawConversationId = useChatStore((state) => state.currentConversationId);
  const conversationId = rawConversationId ?? -1;

  const flatListRef = useRef<FlatList>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    messages,
    loadMore,
    loading,
    hasMore,
    error
  } = usePaginatedMessages(conversationId, conversationVisible);

  const { deleteMessage, isDeleting } = useDeleteMessage({
    onSuccess: (deletedMessage) => {
      console.log('Message deleted successfully:', deletedMessage.id);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
    }
  });

  // Get live messages for current conversation
  const live = useMemo(() => {
    return liveMessages[conversationId] || [];
  }, [liveMessages, conversationId]);

  // Combine and deduplicate messages
  const displayedMessages = useMemo(() => {
    const all = [...messages, ...live];
    const seen = new Set();

    return all
      .filter((msg) => {
        if (seen.has(msg.id)) return false;
        seen.add(msg.id);
        return true;
      })
      // VIKTIG: Sorter i OMVENDT kronologisk rekkefølge for inverted FlatList
      // Dette gjør at eldste meldinger kommer øverst og nyeste nederst når listen er invertert
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [messages, live]);

  // Check if conversation is locked
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === conversationId)
  );

  const isLocked =
    currentConversation?.isPendingApproval === true ||
    conversationId === pendingLockedConversationId;

  // Handle delete with confirmation
  const handleDeleteMessage = async (message: MessageDTO) => {
    const { getActualMessageId } = useChatStore.getState();
    const actualMessageId = getActualMessageId(message);
    
    const messagePreview = message.text 
      ? message.text.length > 50 
        ? `${message.text.slice(0, 50)}...` 
        : message.text
      : "this message";

    Alert.alert(
      "Delete Message",
      `Are you sure you want to delete "${messagePreview}"?\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            await deleteMessage({ 
              ...message, 
              id: actualMessageId 
            });
          }
        }
      ]
    );
  };

  // Render message item
  const renderMessage = ({ item }: { item: MessageDTO }) => (
    <MessageItemNative
      message={item}
      currentUser={currentUser}
      isLocked={isLocked}
      onReply={onReply}
      onDelete={handleDeleteMessage}
      onRetry={onRetryMessage}
      onDeleteFailed={onDeleteFailedMessage}
      onShowUserPopover={onShowUserPopover}
    />
  );

  // Handle load more (for pagination at "top" of inverted list)
  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  // Handle scroll to track position and save it - throttled to reduce bouncing
  const handleScroll = useRef(
    ((event: any) => {
      if (!isInitialized) return; // Don't save position during initialization

      const { contentOffset } = event.nativeEvent;
      
      // Med inverted FlatList: contentOffset.y nær 0 = nederst (nyeste meldinger)
      const isAtBottom = contentOffset.y <= 50;
      onScrollPositionChange?.(isAtBottom);

      // Save scroll position for this conversation (throttled)
      setScrollPosition(conversationId, contentOffset.y);
    })
  ).current;

  // Reset initialization when conversation changes
  useEffect(() => {
    setIsInitialized(false);
  }, [conversationId]);

  // Restore scroll position - only run once when conversation and data are ready
  useEffect(() => {
    if (!flatListRef.current || loading || displayedMessages.length === 0 || isInitialized) {
      return;
    }

    // Get saved position for this conversation
    const savedPosition = scrollPositions[conversationId] || 0;

    // Use requestAnimationFrame for better timing
    const restorePosition = () => {
      requestAnimationFrame(() => {
        if (flatListRef.current && !isInitialized) {
          try {
            // For inverted FlatList, scroll to the saved position immediately
            flatListRef.current.scrollToOffset({
              offset: savedPosition,
              animated: false, // No animation to prevent bouncing
            });
            
            console.log(`📍 Restored scroll position for conversation ${conversationId}: ${savedPosition}`);
            setIsInitialized(true);
          } catch (error) {
            console.warn('Failed to restore scroll position:', error);
            setIsInitialized(true);
          }
        }
      });
    };

    // Shorter delay and use requestAnimationFrame
    const timer = setTimeout(restorePosition, 50);

    return () => clearTimeout(timer);
  }, [conversationId, displayedMessages.length, loading, scrollPositions, isInitialized]);

  // Auto-scroll to bottom for new messages (when at bottom)
  const lastMessageId = displayedMessages[0]?.id; // First item in inverted list is newest
  const previousLastMessageId = useRef<number | null>(null);

  useEffect(() => {
    if (!flatListRef.current || !conversationVisible) return;

    const hasNewMessage = lastMessageId && lastMessageId !== previousLastMessageId.current;
    const savedPosition = scrollPositions[conversationId] || 0;
    const isNearBottom = savedPosition <= 100; // If we were near bottom

    if (hasNewMessage && isNearBottom && isInitialized) {
      // Scroll to top of inverted list (which shows newest messages)
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: true,
      });
    }

    previousLastMessageId.current = lastMessageId;
  }, [lastMessageId, conversationVisible, isInitialized, scrollPositions, conversationId]);

  // Send error to parent
  useEffect(() => {
    onConversationError?.(error);
  }, [error, onConversationError]);

  if (rawConversationId === null) {
    return (
      <View style={styles.noConversationContainer}>
        <Text style={styles.noConversationText}>No conversation selected</Text>
      </View>
    );
  }

  if (loading && displayedMessages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C6B1C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={displayedMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.optimisticId || item.id.toString()}
        
        // VIKTIG: inverted=true for å starte fra bunnen
        inverted={true}
        
        // Load more når vi når "toppen" (som egentlig er bunnen pga inverted)
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        
        // Prevent bouncing by disabling bounces and maintaining content position
        bounces={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100,
        }}
        
        // Prevent initial scroll to top on data changes
        initialScrollIndex={0}
        getItemLayout={undefined} // Let FlatList calculate layout naturally
        
        // Loading indicator vises øverst når vi laster eldre meldinger
        ListFooterComponent={
          loading && displayedMessages.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.loadingMoreText}>Loading more messages...</Text>
            </View>
          ) : null
        }
        
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  noConversationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noConversationText: {
    fontSize: 16,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 2,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  errorMessageContainer: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  myMessageHeader: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  senderInfo: {
    alignItems: 'flex-start',
  },
  mySenderInfo: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  mySenderName: {
    color: '#1C6B1C',
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 10,
    color: '#6B7280',
  },
  replyPreview: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#1C6B1C',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  myReplyPreview: {
    alignSelf: 'flex-end',
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: '#1C6B1C',
  },
  replyContent: {
    gap: 2,
  },
  replyLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  replyText: {
    fontSize: 12,
    color: '#374151',
  },
  messageContent: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  myMessageContent: {
    backgroundColor: '#1C6B1C',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
  },
  myMessageText: {
    color: 'white',
  },
  deletedMessageContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  deletedMessageText: {
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  systemMessageContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  systemMessageText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  systemMessageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  errorActionsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  errorInfo: {
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  sendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sendingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  attachmentsContainer: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    marginTop: 4,
  },
  myAttachmentsContainer: {
    alignSelf: 'flex-end',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  myReactionsContainer: {
    alignSelf: 'flex-end',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
});