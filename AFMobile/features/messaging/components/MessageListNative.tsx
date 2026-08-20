import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { X } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { MessageDTO } from '@shared/types/MessageDTO';
import { useChatStore } from '@/store/useChatStore';
import { useConversationStore } from '@/store/useConversationStore';
import { isPendingConversation } from '@/features/conversation/utils/conversationHelpers';
import { usePaginatedMessages } from '@/hooks/messages/getMessagesForConversation';
import { useDeleteMessage } from '@/hooks/messages/useSoftDelete';
import MessageAttachmentsNative from '@/components/messages/MessageAttachmentsNative';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';
import { formatSentDate } from '@shared/utils/date/chatDate';
import { ReactionHandlerNative } from '@/components/reactions/ReactionHandlerNative';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { useReactionUsersModal } from '@/components/reactions/ReactionUsersModal';
import { ReactionDTO } from '@shared/types/MessageDTO';
import { useMarkConversationNotificationsAsRead } from '@/hooks/messages/useMarkConversationNotificationAsRead';
import ClickableAvatarNative from '@/components/common/ClickableAvatarNative';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types/navigation';

type AppTheme = ReturnType<typeof useUnistyles>['theme'];

interface MessageListNativeRef {
  scrollToBottom: () => void;
}

interface MessageListNativeProps {
  currentUser: UserSummaryDTO | null;
  conversationVisible: boolean;
  onScrollPositionChange?: (atBottom: boolean) => void;
  onReply?: (message: MessageDTO) => void;
  onConversationError?: (error: string | null) => void;
  onRetryMessage?: (message: MessageDTO) => void;
  onDeleteFailedMessage?: (message: MessageDTO) => void;
  conversationParticipants?: UserSummaryDTO[];
  isSearchMode?: boolean;
  searchQuery?: string;
  searchLoading?: boolean;
}

interface MessageItemProps {
  message: MessageDTO;
  currentUser: UserSummaryDTO | null;
  isLocked: boolean;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onRetry?: (message: MessageDTO) => void;
  onDeleteFailed?: (message: MessageDTO) => void;
  onShowReactionUsers?: (reactions: ReactionDTO[]) => void;
  isSearchResult?: boolean;
  searchQuery?: string;
  navigation: StackNavigationProp<RootStackParamList>;
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
  onShowReactionUsers,
  isSearchResult = false,
  searchQuery = '',
  navigation,
}: MessageItemProps) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const isMine = currentUser?.id === message.sender?.id;
  const isOptimistic = message.isOptimistic;
  const hasSendError = message.sendError;

  // For å fjerne isSending
  const isMapped = useChatStore(state =>
    message.optimisticId ? Boolean(state.optimisticToServerIdMap?.[message.optimisticId]) : false
  );

  const shouldShowSending = message.isOptimistic && message.isSending && !isMapped;

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
      onShowReactionUsers?.(message.reactions);
    }
  }, [message?.reactions, onShowReactionUsers]);

  const renderMessageText = useCallback((text: string) => {
    if (!isSearchResult || !searchQuery.trim()) {
      return (
        <Text style={[styles.messageText, isMine && styles.myMessageText]}>
          {text}
        </Text>
      );
    }

    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

    return (
      <Text style={[styles.messageText, isMine && styles.myMessageText]}>
        {parts.map((part, index) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <Text key={index} style={styles.highlightedSearchText}>{part}</Text>
          ) : (
            part // Returner bare string for å arve styling fra parent
          )
        )}
      </Text>
    );
  }, [isSearchResult, searchQuery, isMine, styles]);

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

  // Wrap content in a container to control layout flow
  const messageContent = (
    <View style={styles.messageWrapper}>
      <View
        style={[
          styles.messageContainer,
          isMine ? styles.myMessageContainer : styles.otherMessageContainer,
          isOptimistic && hasSendError && styles.errorMessageContainer,
        ]}
      >
        <View style={[styles.messageHeader, isMine && styles.myMessageHeader]}>
          {!isMine && message.sender && (
            <ClickableAvatarNative
              user={message.sender}
              size={24}
              navigation={navigation}
            />
          )}

          <View style={[styles.senderInfo, isMine && styles.mySenderInfo]}>
            <Text style={[styles.senderName, isMine && styles.mySenderName]}>
              {isMine ? t('conversation.you') : message.sender?.fullName ?? t('conversation.unknownUser')}
            </Text>
            <Text style={styles.messageTime}>
              {formatSentDate(message.sentAt)}
            </Text>
          </View>

          {isMine && currentUser && (
            <MiniAvatarNative
              imageUrl={currentUser.profileImageUrl}
              size={24}
            />
          )}
        </View>

        {message.parentMessageId && (message.parentMessageText || message.parentSender) && (
          <View style={[styles.replyPreview, isMine && styles.myReplyPreview]}>
            <View style={styles.replyContent}>
              <Text style={styles.replyLabel}>
                {t('conversation.replyTo', { name: message.parentSender?.fullName ?? t('conversation.someone') })}
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
            {renderMessageText(message.text)}
          </View>
        )}

        {message.isDeleted && (
          <View style={[
            styles.deletedMessageContainer,
            isMine && styles.myDeletedMessageContainer
          ]}>
            <Text style={styles.deletedMessageText}>{t('conversation.messageDeleted')}</Text>
          </View>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <View style={[styles.attachmentsContainer, isMine && styles.myAttachmentsContainer]}>
            <MessageAttachmentsNative
              attachments={message.attachments}
              isLocked={isLocked}
              isMapped={isMapped}
              message={message}
              currentUser={currentUser}
              onReply={onReply}
              onDelete={onDelete}
            />
          </View>
        )}

        {isOptimistic && hasSendError && (
          <View style={styles.errorActionsContainer}>
            <View style={styles.errorInfo}>
              <Text style={styles.errorText}>{message.sendError}</Text>
            </View>
            <View style={styles.errorButtons}>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => onRetry?.(message)}
              >
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => onDeleteFailed?.(message)}
              >
                <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {shouldShowSending && (
          <View style={styles.sendingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.textMuted} />
            <Text style={styles.sendingText}>{t('conversation.sending')}</Text>
          </View>
        )}
      </View>

      {/* Reaksjoner utenfor messageContainer, men inne i messageWrapper */}
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
      userId={currentUser?.id ?? ""}
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
  conversationVisible,
  onScrollPositionChange,
  onReply,
  onConversationError,
  onRetryMessage,
  onDeleteFailedMessage,
  conversationParticipants = [],
  isSearchMode = false,
  searchQuery = '',
  searchLoading = false,
}, ref) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Add navigation hook
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const { liveMessages, searchResults } = useChatStore();
  const rawConversationId = useChatStore((state) => state.currentConversationId);
  const conversationId = rawConversationId ?? -1;

  const listRef = useRef<FlashList<MessageDTO>>(null);
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

  const [isCurrentlyAtBottom, setIsCurrentlyAtBottom] = useState(true);

  const { markAsReadForConversation } = useMarkConversationNotificationsAsRead();
  const markConversationAsReadLocally = useConversationStore(state => state.markConversationAsReadLocally);

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
    if (isSearchMode) {
      return []; // Ingen live meldinger i søkemodus
    }
    return liveMessages[conversationId] || [];
  }, [liveMessages, conversationId, isSearchMode]);

  // Combine and sort messages
  const displayedMessages = useMemo(() => {
    if (isSearchMode) {
      return searchResults.sort((a, b) =>
        new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      );
    }

    const messageMap = new Map();

    // Add cached messages first
    messages.forEach(msg => {
      const key = msg.optimisticId || msg.id.toString();
      messageMap.set(key, msg);
    });

    // Add live messages, overriding cached ones if same key
    live.forEach(msg => {
      const key = msg.optimisticId || msg.id.toString();
      messageMap.set(key, msg);
    });

    return Array.from(messageMap.values())
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [messages, live, isSearchMode, searchResults]);

  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);
  const currentConversation = useConversationStore((state) =>
    (state.conversations ?? []).find((c) => c.id === conversationId) ??
    (state.pendingConversations ?? []).find((c) => c.id === conversationId)
  );

  const isLocked =
    (!!currentConversation && isPendingConversation(currentConversation)) ||
    conversationId === pendingLockedConversationId;

  const handleDeleteMessage = useCallback(async (message: MessageDTO) => {
    const { getActualMessageId } = useChatStore.getState();
    const actualMessageId = getActualMessageId(message);

    const messagePreview = message.text
      ? message.text.length > 50
        ? `${message.text.slice(0, 50)}...`
        : message.text
      : t('conversation.thisMessage');

    const confirmed = await confirm({
      title: t('conversation.deleteMessageTitle'),
      message: t('conversation.deleteMessageConfirm', { preview: messagePreview })
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
  }, [deleteMessage, confirm, t]);

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
      navigation={navigation} // Pass navigation instead of onShowUserPopover
      onShowReactionUsers={(reactions) =>
        showReactionUsers(reactions, conversationParticipants, navigation)
      }
      // Nye props for søkehighlighting
      isSearchResult={isSearchMode}
      searchQuery={searchQuery}
    />
  ), [
    currentUser, isLocked, onReply, handleDeleteMessage, onRetryMessage,
    onDeleteFailedMessage, navigation, showReactionUsers,
    conversationParticipants, isSearchMode, searchQuery
  ]);

  // Infinite scroll with throttling
  const handleLoadMoreSmooth = useCallback(async () => {
    if (isSearchMode) return;

    const now = Date.now();
    if (now - lastLoadMoreTime.current < LOAD_MORE_THROTTLE_MS) {
      console.log(`Load more throttled (${now - lastLoadMoreTime.current}ms since last)`);
      return;
    }

    if (!hasMore || loading || isLoadingMore) {
      console.log(`Load more skipped: hasMore=${hasMore}, loading=${loading}, isLoadingMore=${isLoadingMore}`);
      return;
    }

    console.log('Starting load more...');
    setIsLoadingMore(true);
    lastLoadMoreTime.current = now;

    try {
      await loadMore();
      console.log('Load more completed');
    } catch (error) {
      console.error('Load more failed:', error);
    } finally {
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 500);
    }
  }, [hasMore, loading, isLoadingMore, loadMore, isSearchMode]);

  const ListEmptyComponent = useMemo(() => {
    // Søkemodus - vis ikke loading når vi venter på søkeresultater
    if (isSearchMode) {
      if (searchLoading) {
        return null; // Ikke vis loading spinner, ConversationScreen håndterer det
      }

      if (searchQuery.length >= 2) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('conversation.noMessagesFound')}</Text>
            <Text style={styles.emptySubtext}>{t('conversation.tryDifferentSearch')}</Text>
          </View>
        );
      }

      return null; // Ikke vis noe når søket er tomt, ConversationScreen håndterer instruksjoner
    }

    // Normal modus - kun vis når ikke laster
    if (!loading && !isSearchMode) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('conversation.noMessagesYet')}</Text>
          <Text style={styles.emptySubtext}>{t('conversation.startConversation')}</Text>
        </View>
      );
    }

    return null;
  }, [isSearchMode, searchLoading, searchQuery, loading, styles, t]);

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

    setIsCurrentlyAtBottom(isAtBottom);
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
      console.log(`Near top (${distanceFromTop}px remaining), considering load more...`);

      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }

      loadMoreThrottleRef.current = setTimeout(() => {
        handleLoadMoreSmooth();
      }, 300);
    }
  }, [isInitialized, hasMore, loading, isLoadingMore, handleLoadMoreSmooth, onScrollPositionChange, getVisibleMessageIndex, showNewMessageBanner]);

  const hasMarkedAsRead = useRef(new Set<number>());

  useEffect(() => {
    if (!conversationVisible || !isCurrentlyAtBottom || !conversationId || conversationId === -1) {
      return;
    }

    // Ikke kjør hvis vi allerede har markert denne samtalen som lest
    if (hasMarkedAsRead.current.has(conversationId)) {
      return;
    }

    console.log(`User entered conversation ${conversationId} - marking as read (first time)`);

    // Markér at vi har behandlet denne samtalen
    hasMarkedAsRead.current.add(conversationId);

    // Kall server API
    markAsReadForConversation(conversationId);

    // Oppdater lokalt
    markConversationAsReadLocally(conversationId);
  }, [
    conversationVisible,
    conversationId,
    isCurrentlyAtBottom,
    markAsReadForConversation,
    markConversationAsReadLocally
  ]);

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
    if (!listRef.current || loading || displayedMessages.length === 0 || !isBootstrapped) {
      return;
    }

    if (isInitialized) {
      return;
    }

    // Initialize at bottom (offset 0 for inverted list)
    listRef.current.scrollToOffset({
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
    if (!listRef.current || !conversationVisible || !isInitialized) return;

    const hasNewMessage = lastMessageId && lastMessageId !== previousLastMessageId.current;

    if (hasNewMessage) {
      const messagesFromBottom = lastVisibleMessageIndex.current;
      const MAX_AUTO_SCROLL_DISTANCE = 4; // Auto-scroll if within 4 messages from bottom

      if (messagesFromBottom <= MAX_AUTO_SCROLL_DISTANCE) {
        // Close enough to bottom - auto scroll
        listRef.current.scrollToOffset({
          offset: 0,
          animated: true,
        });
        currentScrollPosition.current = 0;
        setShowNewMessageBanner(false);
        setNewMessageCount(0);
      } else {
        // Too far from bottom - show notification
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
    if (listRef.current) {
      listRef.current.scrollToOffset({
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup timers
      if (loadMoreThrottleRef.current) {
        clearTimeout(loadMoreThrottleRef.current);
      }

      // Cleanup ref
      hasMarkedAsRead.current.clear();
    };
  }, []);

  // Expose scrollToBottom method via ref
  React.useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      if (listRef.current) {
        listRef.current.scrollToOffset({
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
        <Text style={styles.noConversationText}>{t('conversation.noConversationSelected')}</Text>
      </View>
    );
  }

  if (!isBootstrapped) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('conversation.initializing')}</Text>
      </View>
    );
  }

  if (!isReady && displayedMessages.length === 0 && !isSearchMode) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('conversation.loadingMessages')}</Text>
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
              {t('conversation.newMessageBanner', { count: newMessageCount })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismissNewMessageBanner}
          >
            <X size={16} color={theme.colors.onPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <FlashList
        ref={listRef}
        data={displayedMessages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}

        inverted={true}

        onScroll={handleScroll}
        scrollEventThrottle={32}

        showsVerticalScrollIndicator={false}
        bounces={false}

        ListFooterComponent={
          (loading || isLoadingMore) && displayedMessages.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingMoreText}>
                {t('conversation.loadingMoreMessages')}
              </Text>
            </View>
          ) : null
        }

        ListEmptyComponent={ListEmptyComponent}
      />
    </View>
  );
};

MessageListNative.displayName = 'MessageListNative';

export default React.forwardRef(MessageListNative);

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  noConversationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noConversationText: {
    fontSize: theme.typography.md,
    color: theme.colors.textMuted,
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
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  loadingMoreText: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
  },
  messageWrapper: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginVertical: 2,
  },
  messageContainer: {},
  loadingText: {
    fontSize: theme.typography.md,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  errorMessageContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
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
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.semibold,
    color: theme.colors.textPrimary,
  },
  mySenderName: {
    color: theme.colors.primary,
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  replyPreview: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  myReplyPreview: {
    alignSelf: 'flex-end',
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: theme.colors.primary,
  },
  replyContent: {
    gap: 2,
  },
  replyLabel: {
    fontSize: 10,
    fontWeight: theme.typography.semibold,
    color: theme.colors.textMuted,
  },
  replyText: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSecondary,
  },
  messageContent: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  myMessageContent: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: theme.typography.md,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  myMessageText: {
    color: theme.colors.onPrimary,
  },
  deletedMessageContainer: {
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  deletedMessageText: {
    fontSize: theme.typography.md,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  systemMessageContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  systemMessageText: {
    fontSize: theme.typography.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  systemMessageTime: {
    fontSize: 10,
    color: theme.colors.textDisabled,
    marginTop: theme.spacing.xs,
  },
  errorActionsContainer: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radii.md,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  errorInfo: {
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.xs,
    color: theme.colors.error,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  retryButton: {
    backgroundColor: theme.colors.info,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  retryButtonText: {
    fontSize: theme.typography.xs,
    color: theme.colors.textOnDark,
    fontWeight: theme.typography.medium,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  deleteButtonText: {
    fontSize: theme.typography.xs,
    color: theme.colors.textOnDark,
    fontWeight: theme.typography.medium,
  },
  sendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-end',
  },
  sendingText: {
    fontSize: theme.typography.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  attachmentsContainer: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    marginTop: 2,
  },
  myAttachmentsContainer: {
    alignSelf: 'flex-end',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  myReactionsContainer: {
    alignSelf: 'flex-end',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: theme.typography.sm,
  },
  reactionCount: {
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.semibold,
    color: theme.colors.textMuted,
  },
  // New message banner styles
  newMessageBanner: {
    position: 'absolute',
    top: 12,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 1000,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
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
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.sm,
  },
  newMessageText: {
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
    color: theme.colors.onPrimary,
    textAlign: 'center',
  },
  dismissButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myDeletedMessageContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  highlightedSearchText: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.semibold,
  },
});
