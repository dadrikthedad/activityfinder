// components/messages/MessageInputNative.tsx - Refactored with AttachmentPreview
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
  Modal,
  ActionSheetIOS,
  ScrollView,
  AppState,
} from 'react-native';
import { Camera, Image as ImageLucid, FileText, Plus, ArrowBigRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import { MessageDTO, AttachmentDto } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { getDraftFor, saveDraftFor, clearDraftFor } from '@/utils/draft/draft';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { ReplyPreviewNative } from './ReplyPreviewNative';
import { RNFile, validateFiles } from '@/utils/files/FileFunctions';
import { launchCamera } from 'react-native-image-picker';

// Import our new components
import { AttachmentPreview } from '../files/AttachmentPreview';
import { useAttachmentViewer } from '../files/AttachmentViewer';

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
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const { send, error } = useSendMessage(onMessageSent);
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
    isLocked;

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    if (conversationId) {
      saveDraftFor(conversationId, newText);
    }
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

    // Create optimistic attachments
    const optimisticAttachments: AttachmentDto[] = selectedFiles.map((file, index) => ({
      fileUrl: '',
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
      isOptimistic: true,
      optimisticId: `opt_att_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      localUri: file.uri,
      isUploading: true,
      uploadError: null,
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
      isDeleted: false
    };

    // Add optimistic message to store
    if (conversationId) {
      useChatStore.getState().addMessage(optimisticMessage);
    }

    // Clear input and files immediately
    setText("");
    setSelectedFiles([]);
    onClearReply?.();

    const messageData = hasFiles ? {
      text: trimmed || undefined,
      files: selectedFiles,
      conversationId: conversationId!,
      receiverId: receiverId?.toString(),
      parentMessageId: replyingTo?.id
    } : {
      text: trimmed,
      files: undefined,
      conversationId: conversationId ?? undefined,
      receiverId: receiverId?.toString(),
      parentMessageId: replyingTo?.id
    };

    try {
      const result = await send(messageData);
      
      if (!result) {
        // Update optimistic message and attachments with error
        if (conversationId) {
          useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
            ...optimisticMessage,
            isSending: false,
            sendError: "Failed to send message"
          });
          
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
      console.error("Error sending message:", err);
      
      // Update optimistic message with error
      if (conversationId) {
        useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
          ...optimisticMessage,
          isSending: false,
          sendError: err.message || "Send failed"
        });
        
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

  // Handle camera action
  const handleOpenCamera = async () => {
    if (isCameraActive) return;
    
    setIsCameraActive(true);
    setShowActionsModal(false);
    
    console.log('🎯 Opening camera with react-native-image-picker...');
    
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,
      },
      (response) => {
        console.log('📱 Camera response:', { didCancel: response.didCancel, hasAssets: !!response.assets });
        
        if (response.didCancel || response.errorMessage) {
          console.log('❌ Camera cancelled or error:', response.errorMessage);
          setIsCameraActive(false);
          return;
        }
        
        const asset = response.assets?.[0];
        if (!asset || !asset.uri) {
          console.log('❌ No valid asset or URI received');
          setIsCameraActive(false);
          return;
        }
        
        const file: RNFile = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          size: asset.fileSize
        };
        
        console.log('✅ Camera file created:', file.name);
        setSelectedFiles(prev => [...prev, file]);
        setIsCameraActive(false);
      }
    );
  };

  // Handle image picker
  const handlePickImage = async () => {
    setShowActionsModal(false);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const files: RNFile[] = result.assets.map((asset, index) => {
        const hasVideoExtension = asset.uri.includes('.mp4') || asset.uri.includes('.mov') || asset.uri.includes('.avi');
        const hasVideoType = asset.type?.includes('video');
        const hasVideoDuration = asset.duration != null && asset.duration > 0;
        const isVideo = hasVideoType || (hasVideoExtension && hasVideoDuration);
        
        let mimeType: string = asset.type || '';
        
        if (mimeType === 'image' || (mimeType === '' && !isVideo)) {
          const fileName = asset.fileName || '';
          if (fileName.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (fileName.toLowerCase().includes('.gif')) {
            mimeType = 'image/gif';
          } else if (fileName.toLowerCase().includes('.webp')) {
            mimeType = 'image/webp';
          } else {
            mimeType = 'image/jpeg';
          }
        } else if (mimeType === 'video' || (mimeType === '' && isVideo)) {
          mimeType = 'video/mp4';
        }
        
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        
        return {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `${isVideo ? 'video' : 'image'}_${Date.now()}_${index}.${fileExtension}`,
          size: asset.fileSize
        };
      });
      
      console.log('📷 Library files selected:', files.map(f => ({ name: f.name, type: f.type })));
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  // Handle file picker
  const handlePickFile = async () => {
    setShowActionsModal(false);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const files: RNFile[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: asset.mimeType || 'application/octet-stream',
          name: asset.name,
          size: asset.size
        }));
        
        setSelectedFiles(prev => [...prev, ...files]);
      }
    } catch (err) {
      console.error('Error picking file:', err);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  // Show actions menu
  const handleShowActionsMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Take Photo', 'Choose from Library', 'Select File', 'Cancel'],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 0:
              handleOpenCamera();
              break;
            case 1:
              handlePickImage();
              break;
            case 2:
              handlePickFile();
              break;
          }
        }
      );
    } else {
      setShowActionsModal(true);
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

  const displayError = conversationError || error;

  const getPlaceholder = () => {
    if (isDisabled) return "This conversation has been deleted...";
    if (isBlocked) return "You can't send messages until the request is accepted...";
    if (selectedFiles.length > 0) return "Add a message (optional)...";
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

      {/* 🆕 NEW: File Previews using AttachmentPreview */}
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
                isUploading={false}
                uploadError={null}
                disabled={false}
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
                  isUploading={false}
                  uploadError={null}
                  disabled={false}
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
        {/* Actions button */}
        {!isBlocked && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShowActionsMenu}
          >
            <Plus size={24} color="#ffffffff" />
          </TouchableOpacity>
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
          <ArrowBigRight size={24} color="#ffffffff" />
        </TouchableOpacity>
      </View>

      {/* Actions Modal for Android */}
      <Modal
        visible={showActionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalOption} onPress={handleOpenCamera}>
              <Camera size={24} color="#1C6B1C" />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={handlePickImage}>
              <ImageLucid size={24} color="#1C6B1C" />
              <Text style={styles.modalOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={handlePickFile}>
              <FileText size={24} color="#1C6B1C" />
              <Text style={styles.modalOptionText}>Select File</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#1C6B1C',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
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
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },

  // 🆕 NEW: File preview styles using AttachmentPreview
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