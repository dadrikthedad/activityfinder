// components/messages/MessageListNative.tsx - Cleaned version
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
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
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { useReactionUsersModal } from '@/components/reactions/ReactionUsersModal';
import { ReactionDTO } from '@shared/types/MessageDTO';

interface MessageListNativeRef {
  scrollToBottom: () => void;
}

interface MessageListNativeProps {
  currentUser: UserSummaryDTO | null;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  conversationVisible: boolean;
  onScrollPositionChange?: (atBottom: boolean) => void;
  onReply?: (message: MessageDTO) => void;
  onConversationError?: (error: string | null) => void;
  onRetryMessage?: (message: MessageDTO) => void;
  onDeleteFailedMessage?: (message: MessageDTO) => void;
  conversationParticipants?: UserSummaryDTO[];
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
  onShowReactionUsers?: (emoji: string, reactions: ReactionDTO[]) => void;
}

// Memoized MessageItem for better performance
const MessageItemNative = React.memo(({
  message,
  currentUser,
  isLocked,
  onReply,
  onDelete,
  onRetry,
  onDeleteFailed,
  onShowUserPopover,
  onShowReactionUsers
}: MessageItemProps) => {
  const isMine = currentUser?.id === message.sender?.id;
  const isOptimistic = message.isOptimistic;
  const hasSendError = message.sendError;

  // For å fjerne isSending
  const isMapped = useChatStore(state => 
    message.optimisticId ? Boolean(state.optimisticToServerIdMap?.[message.optimisticId]) : false
  );

  const shouldShowSending = message.isOptimistic && message.isSending && !isMapped;

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

  const handleAvatarPress = useCallback(() => {
    if (message.sender && !isMine && onShowUserPopover) {
      onShowUserPopover(message.sender, { x: 0, y: 0 });
    }
  }, [message.sender, isMine, onShowUserPopover]);

  const existingReactions = message.reactions || [];

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

  const handleReactionPress = useCallback((emoji: string) => {
    if (message?.reactions) {
      onShowReactionUsers?.(emoji, message.reactions);
    }
  }, [message?.reactions, onShowReactionUsers]);

  const messageContent = (
    <View
      style={[
        styles.messageContainer,
        isMine ? styles.myMessageContainer : styles.otherMessageContainer,
        isOptimistic && hasSendError && styles.errorMessageContainer,
      ]}
    >
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

      {message.text && !message.isDeleted && (
        <View style={[styles.messageContent, isMine && styles.myMessageContent]}>
          <Text style={[styles.messageText, isMine && styles.myMessageText]}>
            {message.text}
          </Text>
        </View>
      )}

      {message.isDeleted && (
        <View style={[
          styles.deletedMessageContainer, 
          isMine && styles.myDeletedMessageContainer
        ]}>
          <Text style={styles.deletedMessageText}>This message has been deleted</Text>
        </View>
      )}

      {message.attachments && message.attachments.length > 0 && (
      <View style={[styles.attachmentsContainer, isMine && styles.myAttachmentsContainer]}>
        <MessageAttachmentsNative
          attachments={message.attachments}
          isLocked={isLocked}
          isMapped={isMapped}
          // Nye props for reaction handler
          message={message}
          currentUser={currentUser}
          onReply={onReply}
          onDelete={onDelete}
          onShowUserPopover={onShowUserPopover}
          onShowReactionUsers={onShowReactionUsers}
        />
      </View>
    )}

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

      {shouldShowSending && (
        <View style={styles.sendingIndicator}>
          <ActivityIndicator size="small" color="#6B7280" />
          <Text style={styles.sendingText}>Sending...</Text>
        </View>
      )}

      {groupedReactions.length > 0 && (
        <View style={[styles.reactionsContainer, isMine && styles.myReactionsContainer]}>
          {groupedReactions.map((reaction, index) => (
            <TouchableOpacity 
              key={`${reaction.emoji}-${index}`} 
              style={styles.reactionBubble}
              onPress={() => handleReactionPress(reaction.emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

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

const MessageListNative: React.ForwardRefRenderFunction<MessageListNativeRef, MessageListNativeProps> = ({
  currentUser,
  onShowUserPopover,
  conversationVisible,
  onScrollPositionChange,
  onReply,
  onConversationError,
  onRetryMessage,
  onDeleteFailedMessage,
  conversationParticipants = [],
}, ref) => {
  const { liveMessages } = useChatStore();
  const rawConversationId = useChatStore((state) => state.currentConversationId);
  const conversationId = rawConversationId ?? -1;

  const flatListRef = useRef<FlatList>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Scroll tracking
  const currentScrollPosition = useRef(0);
  const lastVisibleMessageIndex = useRef(0);
  const previousLastMessageId = useRef<number | null>(null);
  
  // Infinite scroll state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadMoreTime = useRef(0);
  const LOAD_MORE_THROTTLE_MS = 2000;
  const LOAD_MORE_THRESHOLD = 400;

  // New message banner state
  const [showNewMessageBanner, setShowNewMessageBanner] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const isBootstrapped = useBootstrapStore(state => state.isBootstrapped);
  const { showReactionUsers } = useReactionUsersModal();
  const { confirm } = useConfirmModalNative();

  const {
    messages,
    loadMore,
    loading,
    hasMore,
    error,
    isReady,
  } = usePaginatedMessages(conversationId, conversationVisible);

  const { deleteMessage } = useDeleteMessage({
    onSuccess: (deletedMessage) => {
      console.log('Message deleted successfully:', deletedMessage.id);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
    }
  });

  const live = useMemo(() => {
    return liveMessages[conversationId] || [];
  }, [liveMessages, conversationId]);

  // Combine and sort messages
  const displayedMessages = useMemo(() => {
    const messageMap = new Map();
    
    // Add cached messages first
    messages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });
    
    // Add live messages, overriding cached ones if same ID
    live.forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    return Array.from(messageMap.values())
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [messages, live]);

  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === conversationId)
  );

  const isLocked =
    currentConversation?.isPendingApproval === true ||
    conversationId === pendingLockedConversationId;

  const handleDeleteMessage = useCallback(async (message: MessageDTO) => {
    const { getActualMessageId } = useChatStore.getState();
    const actualMessageId = getActualMessageId(message);
    
    const messagePreview = message.text 
      ? message.text.length > 50 
        ? `${message.text.slice(0, 50)}...` 
        : message.text
      : "this message";

    const confirmed = await confirm({
      title: "Delete message",
      message: `Are you certain you want to delete "${messagePreview}"?\n\nThis action cannot be undone.`
    });

    if (confirmed) {
      try {
        if (actualMessageId !== null) {
          await deleteMessage({ 
            ...message, 
            id: actualMessageId 
          });
        } else {
          await deleteMessage(message);
        }
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    }
  }, [deleteMessage, confirm]);

  // Render message with stable callback
  const renderMessage = useCallback(({ item }: { item: MessageDTO }) => (
    <MessageItemNative
      message={item}
      currentUser={currentUser}
      isLocked={isLocked}
      onReply={onReply}
      onDelete={handleDeleteMessage}
      onRetry={onRetryMessage}
      onDeleteFailed={onDeleteFailedMessage}
      onShowUserPopover={onShowUserPopover}
      onShowReactionUsers={(emoji, reactions) => 
        showReactionUsers(emoji, reactions, onShowUserPopover, conversationParticipants)
      }
    />
  ), [currentUser, isLocked, onReply, handleDeleteMessage, onRetryMessage, onDeleteFailedMessage, onShowUserPopover, showReactionUsers, conversationParticipants]);

  // Infinite scroll with throttling
  const handleLoadMoreSmooth = useCallback(async () => {
    const now = Date.now();
    if (now - lastLoadMoreTime.current < LOAD_MORE_THROTTLE_MS) {
      console.log(`⏳ Load more throttled (${now - lastLoadMoreTime.current}ms since last)`);
      return;
    }

    if (!hasMore || loading || isLoadingMore) {
      console.log(`🚫 Load more skipped: hasMore=${hasMore}, loading=${loading}, isLoadingMore=${isLoadingMore}`);
      return;
    }

    console.log('🔄 Starting load more...');
    setIsLoadingMore(true);
    lastLoadMoreTime.current = now;

    try {
      await loadMore();
      console.log('✅ Load more completed');
    } catch (error) {
      console.error('❌ Load more failed:', error);
    } finally {
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 500);
    }
  }, [hasMore, loading, isLoadingMore, loadMore]);

  // Calculate visible message index
  const getVisibleMessageIndex = useCallback(() => {
    if (displayedMessages.length === 0) return 0;
    
    const ESTIMATED_MESSAGE_HEIGHT = 120;
    const index = Math.max(0, 
      Math.min(
        Math.floor(currentScrollPosition.current / ESTIMATED_MESSAGE_HEIGHT),
        displayedMessages.length - 1
      )
    );
    return index;
  }, [displayedMessages.length]);

  // Handle scroll events
  const handleScroll = useCallback((event: any) => {
    if (!isInitialized) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    currentScrollPosition.current = contentOffset.y;
    
    const isAtBottom = contentOffset.y <= 50;
    onScrollPositionChange?.(isAtBottom);

    if (isAtBottom && showNewMessageBanner) {
      setShowNewMessageBanner(false);
      setNewMessageCount(0);
    }


    // Update visible message index
    lastVisibleMessageIndex.current = getVisibleMessageIndex();

    // Infinite scroll logic
    const distanceFromTop = contentSize.height - layoutMeasurement.height - contentOffset.y;
    
    if (distanceFromTop <= LOAD_MORE_THRESHOLD && hasMore && !loading && !isLoadingMore) {
      console.log(`📈 Near top (${distanceFromTop}px remaining), considering load more...`);
      
      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }
      
      loadMoreThrottleRef.current = setTimeout(() => {
        handleLoadMoreSmooth();
      }, 300);
    }
  }, [isInitialized, hasMore, loading, isLoadingMore, handleLoadMoreSmooth, onScrollPositionChange, getVisibleMessageIndex, showNewMessageBanner]);

  // Reset state when conversation changes
  useEffect(() => {
    if (conversationId && conversationId !== -1) {
      setIsInitialized(false);
      currentScrollPosition.current = 0;
      setIsLoadingMore(false);
      lastVisibleMessageIndex.current = 0;
      previousLastMessageId.current = null;
      setShowNewMessageBanner(false);
      setNewMessageCount(0);
    }
  }, [conversationId]);

  // Initialize list when ready
  useEffect(() => {
    if (!flatListRef.current || loading || displayedMessages.length === 0 || !isBootstrapped) {
      return;
    }

    if (isInitialized) {
      return;
    }

    // Initialize at bottom (offset 0 for inverted list)
    flatListRef.current.scrollToOffset({
      offset: 0,
      animated: false,
    });
    currentScrollPosition.current = 0;
    
    // Initialize previousLastMessageId to prevent false new message detection
    const currentLastMessageId = displayedMessages[0]?.id;
    if (currentLastMessageId) {
      previousLastMessageId.current = currentLastMessageId;
    }
    
    setIsInitialized(true);
  }, [conversationId, displayedMessages.length, loading, isBootstrapped, isInitialized]);

  // Handle new messages with smart auto-scroll
  const lastMessageId = displayedMessages[0]?.id;

  useEffect(() => {
    if (!flatListRef.current || !conversationVisible || !isInitialized) return;

    const hasNewMessage = lastMessageId && lastMessageId !== previousLastMessageId.current;
    
    if (hasNewMessage) {
      const messagesFromBottom = lastVisibleMessageIndex.current;
      const MAX_AUTO_SCROLL_DISTANCE = 4; // Auto-scroll if within 4 messages from bottom
      
      if (messagesFromBottom <= MAX_AUTO_SCROLL_DISTANCE) {
        // Close enough to bottom - auto scroll
        // console.log(`🔽 Auto-scrolling to bottom (${messagesFromBottom} messages from bottom)`);
        flatListRef.current.scrollToOffset({
          offset: 0,
          animated: true,
        });
        currentScrollPosition.current = 0;
        setShowNewMessageBanner(false);
        setNewMessageCount(0);
      } else {
        // Too far from bottom - show notification
        // console.log(`📢 Showing new message banner (${messagesFromBottom} messages from bottom)`);
        setNewMessageCount(prev => prev + 1);
        setShowNewMessageBanner(true);
      }
    }

    previousLastMessageId.current = lastMessageId;
  }, [lastMessageId, conversationVisible, isInitialized]);

  // Handle new message banner interactions
  const handleDismissNewMessageBanner = useCallback(() => {
    setShowNewMessageBanner(false);
    setNewMessageCount(0);
  }, []);

  const handleScrollToNewMessages = useCallback(() => {
    if (flatListRef.current) {
      console.log('🔽 Scrolling to new messages');
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: true,
      });
      currentScrollPosition.current = 0;
      setShowNewMessageBanner(false);
      setNewMessageCount(0);
    }
  }, []);

  // Handle errors
  useEffect(() => {
    onConversationError?.(error);
  }, [error, onConversationError]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }
    };
  }, []);

  // Expose scrollToBottom method via ref
  React.useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (flatListRef.current) {
        console.log('🔽 Manually scrolling to bottom');
        flatListRef.current.scrollToOffset({
          offset: 0,
          animated: true,
        });
        currentScrollPosition.current = 0;
        setShowNewMessageBanner(false);
        setNewMessageCount(0);
      }
    }
  }));

  // Stable keyExtractor
  const keyExtractor = useCallback((item: MessageDTO) => {
    return item.optimisticId || item.id.toString();
  }, []);

  if (rawConversationId === null) {
    return (
      <View style={styles.noConversationContainer}>
        <Text style={styles.noConversationText}>No conversation selected</Text>
      </View>
    );
  }

  if (!isBootstrapped) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C6B1C" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  if (!isReady && displayedMessages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C6B1C" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* New Message Banner */}
      {showNewMessageBanner && (
        <View style={styles.newMessageBanner}>
          <TouchableOpacity 
            style={styles.newMessageContent}
            onPress={handleScrollToNewMessages}
            activeOpacity={0.8}
          >
            <Text style={styles.newMessageText}>
              {newMessageCount === 1 
                ? "There is a new message in conversation"
                : `There are ${newMessageCount} new messages in conversation`
              }
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dismissButton}
            onPress={handleDismissNewMessageBanner}
          >
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={displayedMessages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        
        inverted={true}
        
        onScroll={handleScroll}
        scrollEventThrottle={32}
        
        showsVerticalScrollIndicator={false}
        bounces={false}
        
        onScrollToIndexFailed={(info) => {
          console.log(`📍 ScrollToIndex failed, falling back to offset:`, info);
          const fallbackOffset = Math.min(
            info.averageItemLength * info.index, 
            info.averageItemLength * Math.min(displayedMessages.length, 20)
          );
          flatListRef.current?.scrollToOffset({
            offset: fallbackOffset,
            animated: false,
          });
        }}
        
        ListFooterComponent={
          (loading || isLoadingMore) && displayedMessages.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.loadingMoreText}>
                Loading more messages...
              </Text>
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
        
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={100}
        initialNumToRender={15}
        windowSize={21}
      />
    </View>
  );
};

MessageListNative.displayName = 'MessageListNative';

export default React.forwardRef(MessageListNative);

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
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
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
    flexDirection: 'row',
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
  // New message banner styles
  newMessageBanner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: '#1C6B1C',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  newMessageContent: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
  },
  newMessageText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    opacity: 0.8,
  },
    myDeletedMessageContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-end',  // Høyre side for mine meldinger
    maxWidth: '80%',
  },
});