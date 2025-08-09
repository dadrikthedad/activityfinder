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
  Modal,
  ActionSheetIOS,
  ScrollView,
} from 'react-native';
import { Camera, Image, FileText, Plus, ChevronRight, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import { MessageDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { getDraftFor, saveDraftFor, clearDraftFor } from '@/utils/draft/draft';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { ReplyPreviewNative } from './ReplyPreviewNative';
import { RNFile, validateFiles, getFileTypeInfo, formatFileSize } from '@/utils/files/FileFunctions';

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
  const [showActions, setShowActions] = useState(true); // Controls if action buttons are visible
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
    
    // Hide actions when user starts typing, show when empty AND no files
    if (newText.trim() && showActions) {
      setShowActions(false);
    } else if (!newText.trim() && selectedFiles.length === 0 && !showActions) {
      setShowActions(true);
    }
    
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
      attachments: [], // Will be populated after successful send
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

    // Clear input and files
    setText("");
    setSelectedFiles([]);
    setShowActions(true);
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
      
      // Restore input text and files
      setText(trimmed);
      setSelectedFiles(selectedFiles);
    }
  };

  // Handle camera action
  const handleOpenCamera = async () => {
    setShowActionsModal(false);
    
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const file: RNFile = {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: `camera_${Date.now()}.jpg`,
        size: asset.fileSize
      };
      
      setSelectedFiles(prev => [...prev, file]);
      setShowActions(false); // Hide actions when files are selected
    }
  };

  // Handle image picker
  const handlePickImage = async () => {
    setShowActionsModal(false);
    
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required to select images.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Allow images and videos
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const files: RNFile[] = result.assets.map((asset, index) => {
        // Determine if it's a video based on URI or type
        const isVideo = asset.uri.includes('.mp4') || asset.uri.includes('.mov') || 
                       asset.type?.includes('video') || asset.duration !== undefined;
        
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        const mimeType = asset.type || (isVideo ? 'video/mp4' : 'image/jpeg');
        
        return {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `${isVideo ? 'video' : 'image'}_${Date.now()}_${index}.${fileExtension}`,
          size: asset.fileSize
        };
      });
      
      setSelectedFiles(prev => [...prev, ...files]);
      setShowActions(false); // Hide actions when files are selected
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
        setShowActions(false); // Hide actions when files are selected
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

  // Show actions again
  const handleShowActions = () => {
    setShowActions(true);
  };

  // Remove file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Show actions again if no files and no text
      if (newFiles.length === 0 && !text.trim()) {
        setShowActions(true);
      }
      return newFiles;
    });
  };

  // Load draft when conversation changes
  useEffect(() => {
    if (!conversationId) return;
    
    const loadDraft = async () => {
      try {
        const existingDraft = await getDraftFor(conversationId);
        setText(existingDraft);
        // Set showActions based on whether there's existing draft text and no files
        setShowActions(!existingDraft.trim() && selectedFiles.length === 0);
      } catch (error) {
        console.error('Failed to load draft:', error);
        setText('');
        setShowActions(true);
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
    if (selectedFiles.length > 0) return "Add a message (optional)...";
    return "Write a message...";
  };

  // File preview component
  const FilePreview = ({ file, index }: { file: RNFile; index: number }) => {
    const fileInfo = getFileTypeInfo(file.type, file.name);
    const isImage = fileInfo.category === 'image';
    
    return (
      <View style={styles.filePreview}>
        <View style={styles.filePreviewContent}>
          {isImage ? (
            <Text style={styles.fileIcon}>🖼️</Text>
          ) : (
            <Text style={styles.fileIcon}>{fileInfo.icon}</Text>
          )}
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            {file.size && (
              <Text style={styles.fileSize}>
                {formatFileSize(file.size)}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeFileButton}
          onPress={() => removeFile(index)}
        >
          <X size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
    );
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

      {/* File Previews */}
      {selectedFiles.length > 0 && (
        <View style={styles.filePreviewContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filePreviewScrollContent}
          >
            {selectedFiles.map((file, index) => (
              <FilePreview key={`${file.uri}-${index}`} file={file} index={index} />
            ))}
          </ScrollView>
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
        {/* Actions button or arrow */}
        {!isBlocked && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={showActions ? handleShowActionsMenu : handleShowActions}
          >
            {showActions ? (
              <Plus size={24} color="#1C6B1C" />
            ) : (
              <ChevronRight size={24} color="#1C6B1C" />
            )}
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
            (!text.trim() && selectedFiles.length === 0 || isBlocked) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={(!text.trim() && selectedFiles.length === 0) || isBlocked}
        >
          <Text style={styles.sendButtonText}>Send</Text>
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
              <Image size={24} color="#1C6B1C" />
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
    backgroundColor: '#F3F4F6',
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
    marginLeft: 0, // Ensure proper spacing with action button
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

  filePreviewContainer: {
    marginBottom: 8,
  },
  filePreviewScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  filePreview: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 200,
  },
  filePreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileIcon: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  fileSize: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  removeFileButton: {
    padding: 4,
    marginLeft: 4,
  },
});