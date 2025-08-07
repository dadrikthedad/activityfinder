// components/messages/NewMessageInputNative.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import { useGroupRequests } from '@/hooks/messages/useGroupRequests';
import { MessageDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { SendGroupRequestsResponseDTO } from '@shared/types/SendGroupRequestsDTO';
import { useConversationUpdate } from '@/hooks/common/useConversationUpdate';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import ButtonNative from '@/components/common/ButtonNative';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';

interface NewMessageInputNativeProps {
  receiverId?: number;
  selectedUsers?: UserSummaryDTO[];
  groupName?: string;
  groupImageUrl?: string | null;
  shouldFocus?: boolean;
  onMessageSent?: (message: MessageDTO) => void;
  onGroupCreated?: (response: SendGroupRequestsResponseDTO) => void;
}

export default function NewMessageInputNative({
  receiverId,
  selectedUsers = [],
  groupName,
  shouldFocus = false,
  onMessageSent,
  onGroupCreated,
  groupImageUrl,
}: NewMessageInputNativeProps) {
  const [text, setText] = useState('');
  const [rawText, setRawText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Hooks for both scenarios
  const { send, error: messageError } = useSendMessage(onMessageSent);
  const {
    sendGroupInvitations,
    isLoading: groupRequestLoading,
    error: groupRequestError,
    clearError: clearGroupError,
  } = useGroupRequests();
  const { refreshConversation } = useConversationUpdate();
  const { approveLocally } = useApproveMessageRequest();

  // Determine if we're in group mode
  const isGroupMode = selectedUsers.length > 1;
  const isDisabled = isGroupMode
    ? groupRequestLoading
    : !rawText.trim() || !receiverId;

  const handleSend = async () => {
    // For 1-til-1 samtaler: krev tekst
    if (!isGroupMode) {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      if (!receiverId) {
        console.error('❌ No receiverId provided for 1-to-1 message');
        return;
      }

      const sendingText = trimmed;
      setRawText('');
      setText('');
      inputRef.current?.focus();

      const payload = {
        text: sendingText,
        receiverId: receiverId.toString(),
      };

      console.log('📤 Sender melding med payload:', payload);

      send(payload).then(async (result) => {
        if (!result) return;

        if (result.isNowApproved) {
          approveLocally(result.conversationId);
        }

        if (!result.isRejectedRequest) {
          await refreshConversation(result.conversationId, {
            logPrefix: '📨',
          });
        }
        onMessageSent?.(result);
      });

      return;
    }

    // For gruppesamtaler: tekst er optional
    try {
      const trimmed = rawText.trim();
      const invitedUserIds = selectedUsers.map((user) => user.id);

      const response = await sendGroupInvitations({
        groupName: groupName?.trim() || undefined,
        invitedUserIds,
        groupImageUrl: groupImageUrl || undefined,
        initialMessage: trimmed || undefined,
      });

      if (response) {
        console.log('✅ Group created successfully:', response);
        setRawText('');
        setText('');
        onGroupCreated?.(response);
        
        Alert.alert(
          'Success',
          `Group "${groupName || 'Unnamed'}" created successfully!`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Failed to create group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  const handleTextChange = (newText: string) => {
    setRawText(newText);
    setText(newText);
  };

  useEffect(() => {
    if (shouldFocus) {
      inputRef.current?.focus();
    }
  }, [shouldFocus]);

  const currentError = messageError || groupRequestError;

  if (currentError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{currentError}</Text>
          {groupRequestError && (
            <TouchableOpacity onPress={clearGroupError} style={styles.errorCloseButton}>
              <Text style={styles.errorCloseText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Group mode info */}
      {isGroupMode && (
        <View style={styles.groupInfo}>
          <Text style={styles.groupInfoText}>
            Creating group with {selectedUsers.length} members
            {groupName && `: "${groupName}"`}
            {groupImageUrl && ' 📷'}
          </Text>
          
          {/* Show selected users */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedUsersList}
            contentContainerStyle={styles.selectedUsersContent}
          >
            {selectedUsers.map((user) => (
              <View key={user.id} style={styles.selectedUserChip}>
                <MiniAvatarNative
                  imageUrl={user.profileImageUrl ?? '/default-avatar.png'}
                  alt={user.fullName}
                  size={24}
                  withBorder={false}
                />
                <Text style={styles.selectedUserName}>{user.fullName}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Message input area */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={text}
          onChangeText={handleTextChange}
          placeholder={
            isGroupMode
              ? 'Write an initial message for the group (optional)...'
              : 'Write a message...'
          }
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
        
        <View style={styles.sendButtonContainer}>
          <ButtonNative
            text={
              isGroupMode
                ? groupRequestLoading
                  ? 'Creating...'
                  : 'Create Group'
                : 'Send'
            }
            onPress={handleSend}
            disabled={isDisabled}
            loading={groupRequestLoading}
            variant="primary"
            size="small"
            style={styles.sendButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  groupInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1C6B1C',
  },
  groupInfoText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  selectedUsersList: {
    maxHeight: 60,
  },
  selectedUsersContent: {
    paddingRight: 16,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
  },
  selectedUserName: {
    fontSize: 12,
    color: '#1f2937',
    maxWidth: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    maxHeight: 120,
    minHeight: 44,
  },
  sendButtonContainer: {
    justifyContent: 'flex-end',
  },
  sendButton: {
    minWidth: 80,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  errorCloseButton: {
    marginLeft: 8,
    padding: 4,
  },
  errorCloseText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
});