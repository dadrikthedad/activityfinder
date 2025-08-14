// screens/ConversationScreen.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { ArrowLeft, ArrowDown, Settings } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { useChatStore } from '@/store/useChatStore';
import { useUserActionPopoverStore } from '@/store/useUserActionPopoverStore';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { MessageDTO } from '@shared/types/MessageDTO';
import { clearDraftFor } from '@/utils/draft/draft';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import MessageListNative from '@/components/messages/MessageListNative';
import MessageInputNative from '@/components/messages/MessageInputNative';
import { MessageSettingsModalNative } from '@/components/messages/MessageSettingsModalNative';
import { ConversationScreenNavigationProp, ConversationScreenRouteProp } from '@/types/navigation';

interface MessageListRef {
  scrollToBottom: () => void;
}

interface ConversationScreenProps {
  navigation: ConversationScreenNavigationProp;
  route: ConversationScreenRouteProp;
}

export default function ConversationScreen({ route, navigation }: ConversationScreenProps) {
  const { conversationId } = route.params; 
  const { isLoggedIn } = useAuth();
  const currentUser = useCurrentUser();
  
  // Chat store state
  const { 
    setCurrentConversationId, 
    conversations,
    cleanupOptimisticForConversation 
  } = useChatStore();
  
  const currentConversation = conversations.find(c => c.id === conversationId);
  const pending = useChatStore(state => state.pendingMessageRequests);
  const pendingLockedConversationId = useChatStore(state => state.pendingLockedConversationId);
  
  // States
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Ref for scroll to bottom functionality
  const messageListRef = useRef<MessageListRef>(null);
  
  const { send } = useSendMessage();
  
  // Check if conversation has error
  const hasConversationError = conversationError !== null;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
    }
  }, [isLoggedIn, navigation]);

  // Redirect if invalid conversation ID
  useEffect(() => {
    if (isLoggedIn && !conversationId) {
      navigation.navigate('MessagesScreen');
    }
  }, [conversationId, navigation, isLoggedIn]);

  // Set current conversation on mount and cleanup on unmount
  useEffect(() => {
    if (conversationId) {
      console.log('🎯 ConversationScreen: Setting conversation ID:', conversationId);
      setCurrentConversationId(conversationId);
      
      // 🐛 DEBUG: Sjekk lagret posisjon
      const savedPosition = useChatStore.getState().scrollPositions[conversationId];
      console.log('📍 ConversationScreen: Found saved position:', savedPosition);
    }
  
  return () => {
    const state = useChatStore.getState();
    
    if (conversationId) {
      console.log("🧹 Cleaning up conversation:", conversationId);
      
      // 1. Convert optimistic to real først
      state.convertOptimisticToReal(conversationId);
      
      // 2. Cache messages
      const live = state.liveMessages[conversationId] ?? [];
      const cached = state.cachedMessages[conversationId] ?? [];
      const combined = [
        ...cached,
        ...live.filter(m => !cached.some(c => c.id === m.id))
      ];
      state.setCachedMessages(conversationId, combined);
      state.clearLiveMessages(conversationId);
      
      // 3. ✨ NYTT: Clean optimistic mappings for denne conversation
      state.cleanupOptimisticForConversation(conversationId);
    }
    
    setCurrentConversationId(null);
    state.setPendingLockedConversationId(null);
  };
}, [conversationId, setCurrentConversationId]);

  useEffect(() => {
  if (conversationId) {
    const isPending = pending.some(r => r.conversationId === conversationId);
    if (isPending) {
      useChatStore.getState().setPendingLockedConversationId(conversationId);
    } else {
      // Clear pending lock if no longer pending
      const currentLocked = useChatStore.getState().pendingLockedConversationId;
      if (currentLocked === conversationId) {
        useChatStore.getState().setPendingLockedConversationId(null);
      }
    }
  }
}, [conversationId, pending]);

  // Clear draft when conversation error occurs
  useEffect(() => {
    if (hasConversationError && conversationId) {
      clearDraftFor(conversationId);
    }
  }, [hasConversationError, conversationId]);

  // User popover handler (adapted for mobile - could use bottom sheet or modal)
  const showUserPopover = useCallback((
    user: UserSummaryDTO,
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
      conversationId?: number;
    },
  ) => {
    // For mobile, show an action sheet instead of popover
    const options = [];
    
    if (groupData?.isGroup) {
      options.push('View Group Info');
      if (groupData.onLeaveGroup) {
        options.push('Leave Group');
      }
    } else {
      options.push('View Profile');
      options.push('Send Message');
    }
    
    options.push('Cancel');
    
    Alert.alert(
      user.fullName || 'User',
      'Choose an action',
      options.map((option, index) => ({
        text: option,
        style: option === 'Cancel' ? 'cancel' : 'default',
        onPress: () => {
          if (option === 'Leave Group' && groupData?.onLeaveGroup) {
            groupData.onLeaveGroup();
          }
          // Handle other actions as needed
        }
      }))
    );
  }, []);

  // Reply handler
  const handleReply = useCallback((message: MessageDTO) => {
    setReplyingTo(message);
  }, []);

  // Retry message handler
  const handleRetryMessage = useCallback(async (failedMessage: MessageDTO) => {
    if (!failedMessage.optimisticId || !conversationId) return;
    
    console.log("🔄 Retrying message:", failedMessage.optimisticId);
    
    // Mark as sending again
    useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
      ...failedMessage,
      isSending: true,
      sendError: null
    });

    // Build messageData from failed message
    const messageData = {
      text: failedMessage.text || undefined,
      files: undefined,
      conversationId: conversationId,
      receiverId: undefined,
      parentMessageId: failedMessage.parentMessageId 
    };

    try {
      const result = await send(messageData);
      
      if (!result) {
        // Send failed again
        useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
          ...failedMessage,
          isSending: false,
          sendError: "Retry failed - please try again"
        });
      }
    } catch (err: unknown) {
      console.error("❌ Retry failed:", err);
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : "Retry failed";
      
      useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
        ...failedMessage,
        isSending: false,
        sendError: errorMessage
      });
    }
  }, [send, conversationId]);

  // Delete failed message handler
  const handleDeleteFailedMessage = useCallback((failedMessage: MessageDTO) => {
    if (!conversationId) return;
    
    console.log("🗑️ Deleting failed message:", failedMessage.optimisticId);
    
    // Remove message from liveMessages
    const current = useChatStore.getState().liveMessages[conversationId] || [];
    const filtered = current.filter(m => m.id !== failedMessage.id);
    
    // Update store directly
    useChatStore.setState((state) => ({
      liveMessages: {
        ...state.liveMessages,
        [conversationId]: filtered
      }
    }));
  }, [conversationId]);

  // Scroll to bottom handler
  const handleScrollToBottom = useCallback(() => {
    if (messageListRef.current?.scrollToBottom) {
      messageListRef.current.scrollToBottom();
    }
  }, []);

  // Settings modal handlers
  const handleOpenSettings = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettingsModal(false);
  }, []);

  // Get conversation title for header
  const getConversationTitle = () => {
    if (!currentConversation) return "Laster samtale...";
    
    if (currentConversation.isGroup) {
      return currentConversation.groupName || "Navnløs gruppe";
    }
    
    const otherUser = currentConversation.participants.find(p => p.id !== currentUser?.id);
    return otherUser?.fullName || "Ukjent bruker";
  };

  // Get conversation subtitle for header
  const getConversationSubtitle = () => {
    if (!currentConversation) return "";
    
    if (currentConversation.isGroup) {
      return `${currentConversation.participants.length} medlemmer`;
    }
    
    return "Privat samtale";
  };

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Loading states
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#1C6B1C" barStyle="light-content" />
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!conversationId) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#1C6B1C" barStyle="light-content" />
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1C6B1C" barStyle="light-content" />
      
      {/* Header with integrated toolbar */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Back button */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          
          {/* Conversation info */}
          <View style={styles.conversationInfo}>
            <Text style={styles.conversationTitle}>
              {getConversationTitle()}
            </Text>
            <Text style={styles.conversationSubtitle}>
              {getConversationSubtitle()}
            </Text>
          </View>
          
          {/* Toolbar buttons */}
          <View style={styles.toolbarButtons}>
            {/* Scroll to bottom button - only show when not at bottom */}
            {!atBottom && (
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={handleScrollToBottom}
              >
                <ArrowDown size={20} color="white" />
              </TouchableOpacity>
            )}
            
            {/* Settings button */}
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={handleOpenSettings}
            >
              <Settings size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Warning banners */}
      {currentConversation?.isPendingApproval && conversationId !== pendingLockedConversationId && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Message request sent. You can send a maximum of 5 messages the receiver will be able to see.
          </Text>
        </View>
      )}

      {pending.some((r) => r.conversationId === conversationId) &&
        conversationId === pendingLockedConversationId && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Approve the conversation to start sending messages.
            </Text>
          </View>
      )}

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Message list - takes remaining space */}
        <View style={styles.messageContainer}>
          <MessageListNative
            ref={messageListRef}
            key={conversationId}
            currentUser={currentUser}
            onShowUserPopover={showUserPopover}
            conversationVisible={true}
            onScrollPositionChange={setAtBottom}
            onReply={handleReply}
            onConversationError={setConversationError}
            onRetryMessage={handleRetryMessage}
            onDeleteFailedMessage={handleDeleteFailedMessage}
            conversationParticipants={currentConversation?.participants || []} 
          />
        </View>

        {/* Message input - at bottom */}
        <View style={styles.inputContainer}>
          <MessageInputNative
            receiverId={undefined}
            onMessageSent={(message) => {
              console.log("📤 Ny melding sendt:", message);
              setReplyingTo(null);
            }}
            atBottom={atBottom}
            onShowUserPopover={showUserPopover}
            replyingTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
            isDisabled={hasConversationError}
            hideToolbar={hasConversationError}
            conversationError={conversationError}
            autoFocus={false}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Settings Modal */}
      <MessageSettingsModalNative
        visible={showSettingsModal}
        onClose={handleCloseSettings}
        onShowUserPopover={showUserPopover}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    borderRadius: 6,
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0,
  },
  conversationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  conversationSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  toolbarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  messageContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});