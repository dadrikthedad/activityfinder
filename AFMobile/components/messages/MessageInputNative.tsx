// components/messages/MessageInputNative.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import { MessageDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { getDraftFor, saveDraftFor, clearDraftFor } from '@/utils/draft/draft';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { ReplyPreviewNative } from './ReplyPreviewNative';

interface MessageInputNativeProps {
  receiverId?: number;
  onMessageSent?: (message: MessageDTO) => void;
  atBottom?: boolean;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  replyingTo?: MessageDTO | null;
  onClearReply?: () => void;
  isDisabled?: boolean;
  hideToolbar?: boolean;
  conversationError?: string | null;
  autoFocus?: boolean;
}

export default function MessageInputNative({
  receiverId,
  onMessageSent,
  atBottom,
  onShowUserPopover,
  replyingTo,
  onClearReply,
  isDisabled = false,
  hideToolbar = false,
  conversationError,
  autoFocus = true,
}: MessageInputNativeProps) {
  const [text, setText] = useState("");
  const { send, error } = useSendMessage(onMessageSent);
  const inputRef = useRef<TextInput>(null);
  const conversationId = useChatStore((state) => state.currentConversationId);
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);
  const user = useCurrentUser();

  const currentConversation = useChatStore((state) =>
    state.conversations.find((c) => c.id === conversationId)
  );

  const effectiveMessageCount = useChatStore((state) => {
    if (conversationId === null) return 0;

    const cached = state.cachedMessages[conversationId] ?? [];
    const live = state.liveMessages[conversationId] ?? [];

    const uniqueLive = live.filter(
      (liveMsg) => !cached.some((c) => c.id === liveMsg.id)
    );

    return cached.length + uniqueLive.length;
  });

  const isLocked =
    conversationId !== null &&
    conversationId === pendingLockedConversationId &&
    currentConversation?.isPendingApproval !== false;

  const isBlocked = 
    isDisabled ||
    (currentConversation?.isPendingApproval && effectiveMessageCount >= 5) ||
    isLocked;

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    if (conversationId) {
      saveDraftFor(conversationId, newText);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    
    if (!trimmed) return;

    // Generate unique optimistic ID
    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic message
    const optimisticMessage: MessageDTO = {
      id: -Date.now(),
      optimisticId,
      isOptimistic: true,
      isSending: true,
      sendError: null,
      senderId: user?.id || null,
      sender: user,
      text: trimmed,
      sentAt: new Date().toISOString(),
      conversationId: conversationId || -1,
      attachments: [],
      reactions: [],
      parentMessageId: replyingTo?.id || null,
      parentMessageText: replyingTo?.text || null,
      parentSender: replyingTo?.sender || null,
      isSystemMessage: false,
      isDeleted: false
    };

    // Add optimistic message to store
    if (conversationId) {
      useChatStore.getState().addMessage(optimisticMessage);
    }

    // Clear input
    setText("");
    onClearReply?.();

    const messageData = {
      text: trimmed,
      files: undefined,
      conversationId: conversationId ?? undefined,
      receiverId: receiverId?.toString(),
      parentMessageId: replyingTo?.id
    };

    try {
      const result = await send(messageData);
      
      if (!result) {
        // Update optimistic message with error
        if (conversationId) {
          useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
            ...optimisticMessage,
            isSending: false,
            sendError: "Failed to send message"
          });
        }
        return;
      }
      
      if (!conversationId && result.conversationId) {
        useChatStore.getState().setCurrentConversationId(result.conversationId);
      }
      
      if (conversationId) {
        clearDraftFor(conversationId);
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      
      // Update optimistic message with error
      if (conversationId) {
        useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
          ...optimisticMessage,
          isSending: false,
          sendError: err.message || "Send failed"
        });
      }
      
      // Restore input text
      setText(trimmed);
    }
  };

  // Load draft when conversation changes
  useEffect(() => {
    if (!conversationId) return;
    
    const loadDraft = async () => {
      try {
        const existingDraft = await getDraftFor(conversationId);
        setText(existingDraft);
      } catch (error) {
        console.error('Failed to load draft:', error);
        setText(''); // Fallback to empty string
      }
    };
    
    loadDraft();
  }, [conversationId]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [conversationId, autoFocus]);

  const displayError = conversationError || error;

  const getPlaceholder = () => {
    if (isDisabled) return "This conversation has been deleted...";
    if (isBlocked) return "You can't send messages until the request is accepted...";
    return "Write a message...";
  };

  return (
    <View style={styles.container}>
      {/* Reply Preview */}
      {replyingTo && (
     <ReplyPreviewNative 
         message={replyingTo} 
         onClear={onClearReply || (() => {})} 
     />
     )}

      {/* Error Display */}
      {displayError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {displayError}</Text>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            isBlocked && styles.textInputDisabled
          ]}
          value={text}
          onChangeText={handleTextChange}
          placeholder={getPlaceholder()}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={2000}
          editable={!isBlocked}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || isBlocked) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!text.trim() || isBlocked}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1C6B1C',
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 14,
    color: '#374151',
  },
  clearReplyButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearReplyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  textInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  sendButton: {
    backgroundColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});