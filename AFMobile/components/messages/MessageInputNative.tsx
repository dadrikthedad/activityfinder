// components/messages/MessageInputNative.tsx - Updated with encrypted attachments support
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  AppState,
} from 'react-native';
import { ArrowBigRight } from 'lucide-react-native';
import { MessageDTO, AttachmentDto } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { getDraftFor, saveDraftFor, clearDraftFor } from '@/utils/draft/draft';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { ReplyPreviewNative } from './ReplyPreviewNative';
import { RNFile, validateFiles } from '@/utils/files/FileFunctions';
import { useSendEncryptedMessage } from '@/hooks/messages/useSendEncryptedMessage';

// Import our new components
import { AttachmentPreview } from '../files/AttachmentPreview';
import { useAttachmentViewer } from '../files/AttachmentViewer';
import { AttachmentPicker } from '../files/filepicker/AttachmentPicker';

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
  const [selectedFiles, setSelectedFiles] = useState<RNFile[]>([]);
  
  const { 
    send, 
    error, 
    loading, 
    e2eeError, 
    encryptionProgress 
  } = useSendEncryptedMessage(onMessageSent);
  
  const inputRef = useRef<TextInput>(null);
  const conversationId = useChatStore((state) => state.currentConversationId);
  const pendingLockedConversationId = useChatStore((state) => state.pendingLockedConversationId);
  const user = useCurrentUser();

  // Use AttachmentViewer hook for file opening
  const { openFile } = useAttachmentViewer({
    files: selectedFiles,
    isMapped: false
  });

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
    isLocked ||
    loading;

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    if (conversationId) {
      saveDraftFor(conversationId, newText);
    }
  };

  // Handle file selection from AttachmentPicker
  const handleFilesSelected = (files: RNFile[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    const hasText = trimmed.length > 0;
    const hasFiles = selectedFiles.length > 0;
    
    if (!hasText && !hasFiles) return;

    // Validate files if any
    if (hasFiles) {
      const validation = validateFiles(selectedFiles);
      if (!validation.isValid) {
        Alert.alert('File Error', validation.error || 'Invalid files selected');
        return;
      }
    }

    // Generate unique optimistic ID
    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic attachments for encrypted files
    const optimisticAttachments: AttachmentDto[] = selectedFiles.map((file, index) => ({
      fileUrl: '', // Will be set after encryption/upload
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
      isOptimistic: true,
      optimisticId: `opt_att_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      localUri: file.uri,
      isUploading: true,
      uploadError: null,
      isEncrypted: true, // Mark as encrypted
    }));

    // Create optimistic message
    const optimisticMessage: MessageDTO = {
      id: -Date.now(),
      optimisticId,
      isOptimistic: true,
      isSending: true,
      sendError: null,
      senderId: user?.id || null,
      sender: user,
      text: trimmed || null,
      sentAt: new Date().toISOString(),
      conversationId: conversationId || -1,
      attachments: optimisticAttachments,
      reactions: [],
      parentMessageId: replyingTo?.id || null,
      parentMessageText: replyingTo?.text || null,
      parentSender: replyingTo?.sender || null,
      isSystemMessage: false,
      isDeleted: false,
    };

    // Add optimistic message to store immediately
    if (conversationId) {
      useChatStore.getState().addMessage(optimisticMessage);
    }

    // Clear input and files immediately for better UX
    setText("");
    setSelectedFiles([]);
    onClearReply?.();

    const messageData = {
      text: hasText ? trimmed : undefined, // Don't send empty string
      files: hasFiles ? selectedFiles : undefined,
      conversationId: conversationId!,
      receiverId: receiverId?.toString(),
      parentMessageId: replyingTo?.id ?? undefined // Convert null to undefined
    };

    try {
      const result = await send(messageData);
      
      if (!result) {
        // Update optimistic message with error
        if (conversationId) {
          useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
            ...optimisticMessage,
            isSending: false,
            sendError: "Failed to send encrypted message"
          });
          
          // Update attachment errors if necessary
          optimisticAttachments.forEach(attachment => {
            if (attachment.optimisticId) {
              useChatStore.getState().updateAttachmentUploadStatus(
                conversationId,
                optimisticMessage.id,
                attachment.optimisticId,
                {
                  isUploading: false,
                  uploadError: "Upload failed"
                }
              );
            }
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
      console.error("Error sending encrypted message:", err);
      
      // Update optimistic message with error
      if (conversationId) {
        useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
          ...optimisticMessage,
          isSending: false,
          sendError: err.message || "Send failed"
        });
        
        // Update attachment errors
        optimisticAttachments.forEach(attachment => {
          if (attachment.optimisticId) {
            useChatStore.getState().updateAttachmentUploadStatus(
              conversationId,
              optimisticMessage.id,
              attachment.optimisticId,
              {
                isUploading: false,
                uploadError: "Upload failed"
              }
            );
          }
        });
      }
      
      // Restore input text and files for retry
      setText(trimmed);
      setSelectedFiles(selectedFiles);
    }
  };

  // Remove file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle file preview press - use AttachmentViewer logic
  const handleFilePreviewPress = (index: number) => {
    openFile(index);
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
        setText('');
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

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('📱 MessageInput - App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        console.log('🔄 App became active in MessageInput');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const displayError = conversationError || error || e2eeError;

  const getPlaceholder = () => {
    if (isDisabled) return "This conversation has been deleted...";
    if (isBlocked) return "You can't send messages until the request is accepted...";
    if (selectedFiles.length > 0) return "Add a message (optional)...";
    return "Write an encrypted message...";
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

      {/* Encryption Progress */}
      {encryptionProgress > 0 && encryptionProgress < 100 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            🔐 Encrypting... {Math.round(encryptionProgress)}%
          </Text>
        </View>
      )}

      {/* File Previews using AttachmentPreview */}
      {selectedFiles.length > 0 && (
        <View style={styles.filePreviewContainer}>
          {selectedFiles.length === 1 ? (
            // Single file - centered, larger
            <View style={styles.singleFileContainer}>
              <AttachmentPreview
                file={selectedFiles[0]}
                index={0}
                totalCount={selectedFiles.length}
                size="medium"
                showRemoveButton={true}
                showGalleryIndicator={false}
                showFileNameFooter={true}
                onPress={() => handleFilePreviewPress(0)}
                onRemove={() => removeFile(0)}
                isBlurred={false}
                isUploading={loading}
                uploadError={null}
                disabled={loading}
                borderColor="white"
              />
            </View>
          ) : (
            // Multiple files - horizontal scroll like MessageAttachmentsNative
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filePreviewScrollContent}
              style={styles.filePreviewScroll}
            >
              {selectedFiles.map((file, index) => (
                <AttachmentPreview
                  key={`${file.uri}-${index}`}
                  file={file}
                  index={index}
                  totalCount={selectedFiles.length}
                  size="small"
                  showRemoveButton={true}
                  showGalleryIndicator={true}
                  showFileNameFooter={true}
                  onPress={() => handleFilePreviewPress(index)}
                  onRemove={() => removeFile(index)}
                  isBlurred={false}
                  isUploading={loading}
                  uploadError={null}
                  disabled={loading}
                  borderColor="white"
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Error Display */}
      {displayError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {displayError}</Text>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputContainer}>
        {/* AttachmentPicker */}
        {!isBlocked && (
          <AttachmentPicker
            onFilesSelected={handleFilesSelected}
            disabled={isBlocked}
            allowMultipleImages={true}
            allowVideos={true}
            allowDocuments={true}
            imageQuality={0.7}
            cameraQuality={0.7}
            modalTitle="Choose Encrypted Attachment"
            accentColor="#1C6B1C"
            buttonBackgroundColor="#1C6B1C"
            buttonColor="#ffffff"
            buttonSize={24}
          />
        )}
        
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            isBlocked && styles.textInputDisabled,
            !isBlocked && styles.textInputWithButton
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
            ((!text.trim() && selectedFiles.length === 0) || isBlocked) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={(!text.trim() && selectedFiles.length === 0) || isBlocked}
        >
          <ArrowBigRight size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
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
  progressContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  progressText: {
    fontSize: 12,
    color: '#0369A1',
    textAlign: 'center',
  },
  encryptionStatusContainer: {
    marginBottom: 8,
  },
  encryptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  encryptionStatusText: {
    fontSize: 12,
    fontWeight: '500',
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
  textInputWithButton: {
    marginLeft: 0,
  },
  textInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  sendButton: {
    backgroundColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  // File preview styles using AttachmentPreview
  filePreviewContainer: {
    marginBottom: 12,
  },
  singleFileContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  filePreviewScroll: {
    marginHorizontal: -4,
    overflow: 'visible',
    borderRadius: 8,
  },
  filePreviewScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
});