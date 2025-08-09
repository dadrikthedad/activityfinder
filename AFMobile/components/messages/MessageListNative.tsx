// components/messages/MessageListNative.tsx
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

const MessageItemNative = ({
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

  const handleAvatarPress = () => {
    if (message.sender && !isMine && onShowUserPopover) {
      onShowUserPopover(message.sender, { x: 0, y: 0 });
    }
  };

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
            <View key={`${reaction.emoji}-${index}`} style={styles.reactionBubble}>
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </View>
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
};

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
  const topRef = useRef<View>(null);
  const bottomRef = useRef<View>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isRestoring = useRef(false);
  
  // 🔧 FIX: Track current scroll position more reliably
  const currentScrollPosition = useRef(0);
  const scrollUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 🆕 NEW: Smooth infinite scroll state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadMoreTime = useRef(0);

  const isBootstrapped = useBootstrapStore(state => state.isBootstrapped);

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

  const live = useMemo(() => {
    return liveMessages[conversationId] || [];
  }, [liveMessages, conversationId]);

  const displayedMessages = useMemo(() => {
    const all = [...messages, ...live];
    const seen = new Set();

    return all
      .filter((msg) => {
        if (seen.has(msg.id)) return false;
        seen.add(msg.id);
        return true;
      })
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [messages, live]);

  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);
  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === conversationId)
  );

  const isLocked =
    currentConversation?.isPendingApproval === true ||
    conversationId === pendingLockedConversationId;

  const handleDeleteMessage = async (message: MessageDTO) => {
    const { getActualMessageId } = useChatStore.getState();
    const actualMessageId = getActualMessageId(message);
    
    const messagePreview = message.text 
      ? message.text.length > 50 
        ? `${message.text.slice(0, 50)}...` 
        : message.text
      : "this message";

    // Bruk din tilpassede modal i stedet for Alert
    const confirmed = await confirm({
      title: "Delete message",
      message: `Are you certain you want to delete "${messagePreview}"?\n\nThis action cannot be undone.`
    });

    if (confirmed) {
      try {
        // Sjekk om actualMessageId er null
        if (actualMessageId !== null) {
          await deleteMessage({ 
            ...message, 
            id: actualMessageId 
          });
        } else {
          // For optimistiske meldinger uten server ID, bruk original melding
          await deleteMessage(message);
        }
      } catch (error) {
        console.error('Failed to delete message:', error);
        // Du kan eventuelt vise en error-modal her også
      }
    }
  };

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

  // 🆕 NEW: Smooth infinite scroll handler
  const handleLoadMoreSmooth = useCallback(async () => {
    // Throttle requests to avoid spam
    const now = Date.now();
    if (now - lastLoadMoreTime.current < 1000) { // Min 1 second between requests
      return;
    }

    if (!hasMore || loading || isLoadingMore) {
      return;
    }

    console.log('🔄 Starting smooth load more...');
    setIsLoadingMore(true);
    lastLoadMoreTime.current = now;

    try {
      await loadMore();
      console.log('✅ Smooth load more completed');
    } catch (error) {
      console.error('❌ Smooth load more failed:', error);
    } finally {
      // Add a small delay to prevent UI flickering
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 300);
    }
  }, [hasMore, loading, isLoadingMore, loadMore]);

  // 🆕 NEW: Enhanced scroll handler with smooth infinite scroll
  const handleScroll = useCallback((event: any) => {
    if (isRestoring.current || !isInitialized) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const targetConversationId = stableConversationId.current;
    
    if (!targetConversationId || targetConversationId === -1) {
      return;
    }
    
    // Update current position immediately
    currentScrollPosition.current = contentOffset.y;
    
    const isAtBottom = contentOffset.y <= 50;
    onScrollPositionChange?.(isAtBottom);

    // 🆕 NEW: Check if we're near the top (which is bottom in inverted list) to load more
    const distanceFromTop = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const loadMoreThreshold = 200; // Trigger when 200px from top
    
    if (distanceFromTop <= loadMoreThreshold && hasMore && !loading && !isLoadingMore) {
      console.log(`📈 Near top (${distanceFromTop}px remaining), triggering smooth load more`);
      
      // Throttle the load more requests
      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }
      
      loadMoreThrottleRef.current = setTimeout(() => {
        handleLoadMoreSmooth();
      }, 100); // Small delay to avoid multiple rapid calls
    }

    // Save scroll position (debounced)
    if (scrollUpdateTimer.current) {
      clearTimeout(scrollUpdateTimer.current);
    }
    
    scrollUpdateTimer.current = setTimeout(() => {
      const ESTIMATED_MESSAGE_HEIGHT = 100;
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
        
        console.log(`📍 Scroll ended - saving position:`, {
          messageId: visibleMessage.id,
          offset: contentOffset.y,
          messageText: visibleMessage.text?.substring(0, 20) + '...'
        });
        
        setScrollMessageId(targetConversationId, scrollData);
      }
    }, 500);

  }, [displayedMessages, setScrollMessageId, onScrollPositionChange, isInitialized, hasMore, loading, isLoadingMore, handleLoadMoreSmooth]);

  const stableConversationId = useRef(conversationId);
  
  useEffect(() => {
    if (conversationId && conversationId !== -1) {
      stableConversationId.current = conversationId;
    }
  }, [conversationId]);

  // 🔧 FIX 2: Simplified viewport tracking - only when scroll tracking fails
  const trackVisibleItems = useCallback((info: any) => {
    if (isRestoring.current || !isInitialized) return;
    
    const targetConversationId = stableConversationId.current;
    if (!targetConversationId || targetConversationId === -1) return;

    const visibleItems = info.viewableItems;
    if (visibleItems.length > 0) {
      // Only save if we haven't saved recently (avoid duplicate saves)
      const lastSave = useChatStore.getState().scrollMessageIds[targetConversationId]?.timestamp || 0;
      const now = Date.now();
      
      if (now - lastSave > 1000) { // Only save if last save was >1 second ago
        const firstVisibleMessage = visibleItems[0].item;
        
        const scrollData = {
          messageId: firstVisibleMessage.id,
          offset: currentScrollPosition.current,
          timestamp: now
        };
        
        console.log(`👁️ Viewport fallback save:`, {
          messageId: firstVisibleMessage.id,
          messageText: firstVisibleMessage.text?.substring(0, 20) + '...'
        });
        
        setScrollMessageId(targetConversationId, scrollData);
      }
    }
  }, [setScrollMessageId, isInitialized]);

  useEffect(() => {
    console.log(`🔄 Conversation changed to: ${conversationId}, resetting initialization`);
    
    if (conversationId && conversationId !== -1) {
      setIsInitialized(false);
      isRestoring.current = false;
      currentScrollPosition.current = 0;
      setIsLoadingMore(false); // 🆕 NEW: Reset loading more state
    }
  }, [conversationId]);

  // 🔧 FIX 4: Enhanced restoration logic with forced initial tracking
  useEffect(() => {
    console.log(`📋 Restore effect triggered:`, {
      hasRef: !!flatListRef.current,
      loading,
      messagesLength: displayedMessages.length,
      isInitialized,
      conversationId,
      isBootstrapped
    });

    if (!flatListRef.current || loading || displayedMessages.length === 0 || !isBootstrapped) {
      return;
    }

    if (isInitialized) {
      return;
    }

    if (isRestoring.current) {
      console.log(`🚫 Already restoring, skipping...`);
      return;
    }

    isRestoring.current = true;

    const restorePosition = () => {
      if (flatListRef.current && !isInitialized && displayedMessages.length > 0) {
        try {
          const scrollData = useChatStore.getState().scrollMessageIds[conversationId];
          
          if (scrollData?.messageId) {
            const messageIndex = displayedMessages.findIndex(msg => msg.id === scrollData.messageId);
            
            if (messageIndex >= 0) {
              console.log(`🎯 Restoring to message ID ${scrollData.messageId} at index ${messageIndex}`);
              
              flatListRef.current.scrollToIndex({
                index: messageIndex,
                animated: false,
                viewPosition: 0.1,
              });
              
              currentScrollPosition.current = scrollData.offset;
              console.log(`✅ Successfully restored to message at index ${messageIndex}`);
            } else {
              console.log(`⚠️ Message ID ${scrollData.messageId} not found, using offset fallback`);
              
              flatListRef.current.scrollToOffset({
                offset: scrollData.offset,
                animated: false,
              });
              
              currentScrollPosition.current = scrollData.offset;
            }
          } else {
            const savedPosition = scrollPositions[conversationId] || 0;
            console.log(`📍 No message ID saved, using offset: ${savedPosition}`);
            
            flatListRef.current.scrollToOffset({
              offset: savedPosition,
              animated: false,
            });
            
            currentScrollPosition.current = savedPosition;
          }
          
          setIsInitialized(true);
          isRestoring.current = false;
          console.log(`🎯 Restoration complete for conversation ${conversationId}`);
          
          // Force initial tracking after restoration
          setTimeout(() => {
            const ESTIMATED_MESSAGE_HEIGHT = 100;
            const visibleMessageIndex = Math.max(0, 
              Math.min(
                Math.floor(currentScrollPosition.current / ESTIMATED_MESSAGE_HEIGHT),
                displayedMessages.length - 1
              )
            );
            
            const visibleMessage = displayedMessages[visibleMessageIndex];
            
            if (visibleMessage) {
              const initialScrollData = {
                messageId: visibleMessage.id,
                offset: currentScrollPosition.current,
                timestamp: Date.now()
              };
              
              console.log(`🎯 FORCE Initial tracking after restoration:`, {
                messageId: visibleMessage.id,
                messageText: visibleMessage.text?.substring(0, 20) + '...',
                offset: currentScrollPosition.current
              });
              
              setScrollMessageId(conversationId, initialScrollData);
            }
          }, 100);
          
        } catch (error) {
          console.warn('❌ Failed to restore scroll position:', error);
          setIsInitialized(true);
          isRestoring.current = false;
        }
      }
    };

    const timer = setTimeout(restorePosition, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [conversationId, displayedMessages.length, loading, scrollPositions, isBootstrapped, setScrollMessageId]);

  const lastMessageId = displayedMessages[0]?.id;
  const previousLastMessageId = useRef<number | null>(null);

  useEffect(() => {
    if (!flatListRef.current || !conversationVisible) return;

    const hasNewMessage = lastMessageId && lastMessageId !== previousLastMessageId.current;
    const savedPosition = scrollPositions[conversationId] || 0;
    const isNearBottom = savedPosition <= 100;

    console.log(`🆕 New message check:`, {
      hasNewMessage,
      lastMessageId,
      previousLastMessageId: previousLastMessageId.current,
      savedPosition,
      isNearBottom,
      isInitialized
    });

    if (hasNewMessage && isNearBottom && isInitialized) {
      console.log(`🔽 Auto-scrolling to bottom for new message`);
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: true,
      });
      currentScrollPosition.current = 0;
    }

    previousLastMessageId.current = lastMessageId;
  }, [lastMessageId, conversationVisible, isInitialized, scrollPositions, conversationId]);

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
        keyExtractor={(item) => item.optimisticId || item.id.toString()}
        
        inverted={true}
        
        // 🆕 REMOVED: onEndReached since we handle it in onScroll now
        // onEndReached={handleLoadMore}
        // onEndReachedThreshold={0.1}
        
        // Enhanced scroll tracking with smooth infinite scroll
        onScroll={handleScroll}
        scrollEventThrottle={16} // Higher frequency for smoother infinite scroll detection
        
        // Viewport tracking as fallback
        onViewableItemsChanged={trackVisibleItems}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 25,
          minimumViewTime: 250
        }}
        
        showsVerticalScrollIndicator={false}
        
        bounces={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100,
        }}
        
        getItemLayout={(data, index) => ({
          length: 100,
          offset: 100 * index,
          index,
        })}
        
        onScrollToIndexFailed={(info) => {
          console.log(`📍 ScrollToIndex failed, falling back to offset:`, info);
          flatListRef.current?.scrollToOffset({
            offset: Math.min(info.averageItemLength * info.index, info.averageItemLength * displayedMessages.length),
            animated: false,
          });
        }}
        
        ListFooterComponent={
          (loading || isLoadingMore) && displayedMessages.length > 0 ? (
            <View style={styles.loadingMore}>
              <View ref={topRef} style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }} />
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.loadingMoreText}>
                {isLoadingMore ? 'Loading more messages...' : 'Loading...'}
              </Text>
            </View>
          ) : (
            <View ref={topRef} style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }} />
          )
        }
        
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : null
        }
        
        ListHeaderComponent={
          <View ref={bottomRef} style={{ position: 'absolute', bottom: 0, left: 0, width: 1, height: 1 }} />
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