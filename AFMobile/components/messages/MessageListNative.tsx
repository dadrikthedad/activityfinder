// components/messages/MessageListNative.tsx - Optimalisert versjon
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
import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';

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

// 🎯 OPTIMIZATION 1: Memoized MessageItem for better performance
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
        <View style={styles.deletedMessageContainer}>
          <Text style={styles.deletedMessageText}>This message has been deleted</Text>
        </View>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <View style={[styles.attachmentsContainer, isMine && styles.myAttachmentsContainer]}>
          <MessageAttachmentsNative
            attachments={message.attachments}
            isLocked={isLocked}
            isMapped={isMapped} 
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
  // Fjern props destructuring siden vi allerede har det her
  const { 
    liveMessages, 
    scrollPositions, 
    setScrollPosition,
    scrollMessageIds,
    setScrollMessageId
  } = useChatStore();
  const rawConversationId = useChatStore((state) => state.currentConversationId);
  const conversationId = rawConversationId ?? -1;

  const flatListRef = useRef<FlatList>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isRestoring = useRef(false);
  
  // 🔧 FIX 1: Mindre aggressiv scroll tracking
  const currentScrollPosition = useRef(0);
  const scrollUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 🔧 FIX 2: Mer konservativ infinite scroll
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadMoreTime = useRef(0);
  const LOAD_MORE_THROTTLE_MS = 2000; // Økt fra 1000ms til 2000ms
  const LOAD_MORE_THRESHOLD = 400; // Økt fra 200px til 400px

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

  const { deleteMessage, isDeleting } = useDeleteMessage({
    onSuccess: (deletedMessage) => {
      console.log('Message deleted successfully:', deletedMessage.id);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
    }
  });

  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  const isLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    if (conversationVisible) {
      ScreenOrientation.unlockAsync();
      
      const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const { width, height } = Dimensions.get('window');
        setDimensions({ width, height });
      });

      return () => subscription?.remove();
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [conversationVisible]);

  const live = useMemo(() => {
    return liveMessages[conversationId] || [];
  }, [liveMessages, conversationId]);

  // 🎯 OPTIMIZATION 2: Mer stabil message sorting og deduplication
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

  // 🎯 OPTIMIZATION 3: Stabilized renderMessage with useCallback
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

  // 🔧 FIX 3: Mer konservativ infinite scroll med bedre throttling
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

    console.log('🔄 Starting conservative load more...');
    setIsLoadingMore(true);
    lastLoadMoreTime.current = now;

    try {
      await loadMore();
      console.log('✅ Conservative load more completed');
    } catch (error) {
      console.error('❌ Conservative load more failed:', error);
    } finally {
      // Longer delay to prevent UI conflicts
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 500);
    }
  }, [hasMore, loading, isLoadingMore, loadMore]);

  // 🔧 FIX 4: Optimized scroll handler med mindre aggressiv tracking
  const handleScroll = useCallback((event: any) => {
    if (isRestoring.current || !isInitialized) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const targetConversationId = stableConversationId.current;
    
    if (!targetConversationId || targetConversationId === -1) {
      return;
    }
    
    currentScrollPosition.current = contentOffset.y;
    
    const isAtBottom = contentOffset.y <= 50;
    onScrollPositionChange?.(isAtBottom);

    // 🔧 FIX 5: Mer konservativ infinite scroll triggering
    const distanceFromTop = contentSize.height - layoutMeasurement.height - contentOffset.y;
    
    if (distanceFromTop <= LOAD_MORE_THRESHOLD && hasMore && !loading && !isLoadingMore) {
      console.log(`📈 Near top (${distanceFromTop}px remaining), considering load more...`);
      
      // Clear any existing throttle timer
      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }
      
      // More conservative throttling
      loadMoreThrottleRef.current = setTimeout(() => {
        handleLoadMoreSmooth();
      }, 300);
    }

    // 🔧 FIX 6: Mindre aggressiv scroll position saving
    if (scrollUpdateTimer.current) {
      clearTimeout(scrollUpdateTimer.current);
    }
    
    scrollUpdateTimer.current = setTimeout(() => {
      if (displayedMessages.length > 0) {
        const ESTIMATED_MESSAGE_HEIGHT = 120; // Økt fra 100 til 120
        const visibleMessageIndex = Math.max(0, 
          Math.min(
            Math.floor(contentOffset.y / ESTIMATED_MESSAGE_HEIGHT),
            displayedMessages.length - 1
          )
        );
        
        const visibleMessage = displayedMessages[visibleMessageIndex];

        if (visibleMessage) {
          const scrollData = {
            messageId: visibleMessage.id,
            offset: contentOffset.y,
            timestamp: Date.now()
          };
          
          setScrollMessageId(targetConversationId, scrollData);
        }
      }
    }, 1000); // Økt fra 500ms til 1000ms

  }, [displayedMessages, setScrollMessageId, onScrollPositionChange, isInitialized, hasMore, loading, isLoadingMore, handleLoadMoreSmooth]);

  const stableConversationId = useRef(conversationId);

  useEffect(() => {
    if (conversationId && conversationId !== -1) {
      stableConversationId.current = conversationId;
    }
  }, [conversationId]);

  // 🔧 FIX 7: Simplified viewport tracking - kun som backup
  const trackVisibleItems = useCallback((info: any) => {
    if (isRestoring.current || !isInitialized) return;
    
    const targetConversationId = stableConversationId.current;
    if (!targetConversationId || targetConversationId === -1) return;

    const visibleItems = info.viewableItems;
    if (visibleItems.length > 0) {
      const lastSave = useChatStore.getState().scrollMessageIds[targetConversationId]?.timestamp || 0;
      const now = Date.now();
      
      if (now - lastSave > 2000) { // Økt fra 1000ms til 2000ms
        const firstVisibleMessage = visibleItems[0].item;
        
        const scrollData = {
          messageId: firstVisibleMessage.id,
          offset: currentScrollPosition.current,
          timestamp: now
        };
        
        setScrollMessageId(targetConversationId, scrollData);
      }
    }
  }, [setScrollMessageId, isInitialized]);

  useEffect(() => {
    if (conversationId && conversationId !== -1) {
      setIsInitialized(false);
      isRestoring.current = false;
      currentScrollPosition.current = 0;
      setIsLoadingMore(false);
    }
  }, [conversationId]);

  // 🔧 FIX 8: Forenklet scroll restoration
  useEffect(() => {
    if (!flatListRef.current || loading || displayedMessages.length === 0 || !isBootstrapped) {
      return;
    }

    if (isInitialized || isRestoring.current) {
      return;
    }

    isRestoring.current = true;

    const restorePosition = () => {
      if (flatListRef.current && !isInitialized && displayedMessages.length > 0) {
        try {
          const scrollData = useChatStore.getState().scrollMessageIds[conversationId];
          
          if (scrollData?.messageId) {
            const messageIndex = displayedMessages.findIndex(msg => msg.id === scrollData.messageId);
            
            if (messageIndex >= 0 && messageIndex < 10) { // Kun restore hvis nær toppen
              flatListRef.current.scrollToIndex({
                index: messageIndex,
                animated: false,
                viewPosition: 0.1,
              });
              currentScrollPosition.current = scrollData.offset;
            } else {
              // Fallback til simpel offset
              const savedPosition = Math.min(scrollData.offset, 1000); // Max 1000px scroll
              flatListRef.current.scrollToOffset({
                offset: savedPosition,
                animated: false,
              });
              currentScrollPosition.current = savedPosition;
            }
          } else {
            // Ingen saved position - start på bunnen
            flatListRef.current.scrollToOffset({
              offset: 0,
              animated: false,
            });
            currentScrollPosition.current = 0;
          }
          
          setIsInitialized(true);
          isRestoring.current = false;
          
        } catch (error) {
          console.warn('❌ Failed to restore scroll position:', error);
          setIsInitialized(true);
          isRestoring.current = false;
        }
      }
    };

    const timer = setTimeout(restorePosition, 100);
    return () => clearTimeout(timer);
  }, [conversationId, displayedMessages.length, loading, isBootstrapped]);

  // Auto-scroll til nye meldinger
  const lastMessageId = displayedMessages[0]?.id;
  const previousLastMessageId = useRef<number | null>(null);

  useEffect(() => {
    if (!flatListRef.current || !conversationVisible || !isInitialized) return;

    const hasNewMessage = lastMessageId && lastMessageId !== previousLastMessageId.current;
    const isNearBottom = currentScrollPosition.current <= 100;

    if (hasNewMessage && isNearBottom) {
      console.log(`🔽 Auto-scrolling to bottom for new message`);
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: true,
      });
      currentScrollPosition.current = 0;
    }

    previousLastMessageId.current = lastMessageId;
  }, [lastMessageId, conversationVisible, isInitialized]);

  useEffect(() => {
    onConversationError?.(error);
  }, [error, onConversationError]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (scrollUpdateTimer.current) {
        clearTimeout(scrollUpdateTimer.current);
      }
      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }
    };
  }, []);

  // 🆕 SCROLL TO BOTTOM FUNCTION: Expose scrollToBottom method via ref
  React.useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (flatListRef.current) {
        console.log('🔽 Manually scrolling to bottom');
        flatListRef.current.scrollToOffset({
          offset: 0,
          animated: true,
        });
        currentScrollPosition.current = 0;
      }
    }
  }));

  // 🎯 OPTIMIZATION 4: Stable keyExtractor
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
      <FlatList
        ref={flatListRef}
        data={displayedMessages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        
        inverted={true}
        
        // 🔧 FIX 9: Optimized scroll settings
        onScroll={handleScroll}
        scrollEventThrottle={32} // Redusert fra 16 til 32 for mindre aggressiv tracking
        
        onViewableItemsChanged={trackVisibleItems}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50, // Økt fra 25 til 50
          minimumViewTime: 500 // Økt fra 250 til 500
        }}
        
        showsVerticalScrollIndicator={false}
        
        // 🔧 FIX 10: Fjernet bounces og maintainVisibleContentPosition som kan forårsake problemer
        bounces={false}
        // maintainVisibleContentPosition fjernet for å unngå konflikter
        
        // 🔧 FIX 11: Fjernet getItemLayout siden det forårsaker problemer med variabel høyde
        // getItemLayout fjernet
        
        onScrollToIndexFailed={(info) => {
          console.log(`📍 ScrollToIndex failed, falling back to offset:`, info);
          const fallbackOffset = Math.min(
            info.averageItemLength * info.index, 
            info.averageItemLength * Math.min(displayedMessages.length, 20) // Begrenset fallback
          );
          flatListRef.current?.scrollToOffset({
            offset: fallbackOffset,
            animated: false,
          });
        }}
        
        // 🔧 FIX 12: Forenklet ListFooterComponent
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
        
        // 🎯 OPTIMIZATION 5: Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10} // Redusert fra default
        updateCellsBatchingPeriod={100} // Økt for mindre aggressiv re-rendering
        initialNumToRender={15} // Redusert fra default 10
        windowSize={21} // Default er 21, men eksplisitt satt
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
});