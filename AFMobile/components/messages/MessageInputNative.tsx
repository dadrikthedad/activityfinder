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
  Image as ImageReact,
} from 'react-native';
import { Camera, Image as ImageLucid, FileText, Plus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSendMessage } from '@/hooks/messages/useSendMessage';
import { MessageDTO, AttachmentDto } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { getDraftFor, saveDraftFor, clearDraftFor } from '@/utils/draft/draft';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { ReplyPreviewNative } from './ReplyPreviewNative';
import { RNFile, validateFiles, getFileTypeInfo, formatFileSize } from '@/utils/files/FileFunctions';
import FileViewerNative from '../files/FileViewerNative';

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
  // Removed showActions state - always show the plus button
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
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
      fileUrl: '', // Tomt for optimistic
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
      // Optimistic fields
      isOptimistic: true,
      optimisticId: `opt_att_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      localUri: file.uri, // For preview i React Native
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
      attachments: optimisticAttachments, // Vis filene umiddelbart med lokal URI
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

    // Clear input and files immediately (for god UX)
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
        // Update optimistic message and all attachments with error
        if (conversationId) {
          useChatStore.getState().updateMessage(conversationId, optimisticMessage.id, {
            ...optimisticMessage,
            isSending: false,
            sendError: "Failed to send message"
          });
          
          // Update all attachments with error
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
        
        // Update all attachments with error
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
      // Plus button always visible - no need to hide
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
        // Better video detection - only consider it video if it actually has video indicators
        const hasVideoExtension = asset.uri.includes('.mp4') || asset.uri.includes('.mov') || asset.uri.includes('.avi');
        const hasVideoType = asset.type?.includes('video');
        const hasVideoDuration = asset.duration != null && asset.duration > 0;
        const isVideo = hasVideoType || (hasVideoExtension && hasVideoDuration);
        
        let mimeType: string = asset.type || '';
        
        // Fix MIME type based on actual content type
        if (mimeType === 'image' || (mimeType === '' && !isVideo)) {
          // It's an image - detect specific type from filename if possible
          const fileName = asset.fileName || '';
          if (fileName.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (fileName.toLowerCase().includes('.gif')) {
            mimeType = 'image/gif';
          } else if (fileName.toLowerCase().includes('.webp')) {
            mimeType = 'image/webp';
          } else {
            mimeType = 'image/jpeg'; // Default for images
          }
        } else if (mimeType === 'video' || (mimeType === '' && isVideo)) {
          mimeType = 'video/mp4'; // Default for videos
        }
        
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        
        return {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `${isVideo ? 'video' : 'image'}_${Date.now()}_${index}.${fileExtension}`,
          size: asset.fileSize
        };
      });
      
      // Debug logging to see what we're getting
      console.log('📷 Library files selected:', files.map(f => ({ name: f.name, type: f.type, uri: f.uri.substring(0, 50) + '...' })));
      
      setSelectedFiles(prev => [...prev, ...files]);
      // Plus button always visible - no need to hide
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
        // Plus button always visible - no need to hide
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

  // Remove showActions function - not needed anymore

  // Remove file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Open file viewer
  const openFileViewer = (index: number) => {
    setSelectedFileIndex(index);
    setShowFileViewer(true);
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

  const displayError = conversationError || error;

  const getPlaceholder = () => {
    if (isDisabled) return "This conversation has been deleted...";
    if (isBlocked) return "You can't send messages until the request is accepted...";
    if (selectedFiles.length > 0) return "Add a message (optional)...";
    return "Write a message...";
  };

  // File preview component with smart filename truncation
  const FilePreview = ({ file, index }: { file: RNFile; index: number }) => {
    const fileInfo = getFileTypeInfo(file.type, file.name);
    const isImage = fileInfo.category === 'image';
    const isVideo = fileInfo.category === 'video';
    const isPreviewable = isImage || isVideo;
    
    // Debug logging for file categorization
    console.log(`📋 File ${index}:`, {
      name: file.name,
      type: file.type,
      category: fileInfo.category,
      isPreviewable,
      icon: fileInfo.icon
    });
    
    // Smart filename truncation - always keep extension
    const getDisplayFileName = (fileName: string, maxLength: number = 15) => {
      if (fileName.length <= maxLength) return fileName;
      
      const parts = fileName.split('.');
      if (parts.length < 2) {
        // No extension, just truncate
        return fileName.substring(0, maxLength - 3) + '...';
      }
      
      const extension = parts.pop()!; // Get extension
      const nameWithoutExt = parts.join('.');
      const maxNameLength = maxLength - extension.length - 4; // -4 for "..." and "."
      
      if (maxNameLength <= 0) {
        // If extension is too long, just show extension
        return '...' + extension;
      }
      
      return nameWithoutExt.substring(0, maxNameLength) + '...' + extension;
    };
    
    return (
      <TouchableOpacity 
        style={[
          styles.filePreview,
          isPreviewable && styles.filePreviewClickable
        ]}
        onPress={() => isPreviewable ? openFileViewer(index) : undefined}
        activeOpacity={isPreviewable ? 0.7 : 1}
      >
        {/* Remove button - top right corner */}
        <TouchableOpacity
          style={styles.removeFileButton}
          onPress={() => removeFile(index)}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <View style={styles.removeFileButtonInner}>
            <X size={12} color="white" />
          </View>
        </TouchableOpacity>

        <View style={styles.filePreviewContent}>
          {/* Media preview section */}
          <View style={styles.mediaPreviewSection}>
            {isImage && file.uri ? (
              <View style={styles.imagePreviewContainer}>
                <ImageReact
                  source={{ uri: file.uri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Text style={styles.imageOverlayText}>🖼️</Text>
                </View>
              </View>
            ) : isVideo ? (
              <View style={styles.videoPreviewContainer}>
                {/* Show actual video frame as background */}
                <ImageReact
                  source={{ uri: file.uri }}
                  style={styles.videoThumbnail}
                  resizeMode="cover"
                />
                {/* Play button overlay */}
                <View style={styles.playOverlay}>
                  <View style={styles.playButton}>
                    <Text style={styles.playIcon}>▶️</Text>
                  </View>
                </View>
                {/* Video indicator overlay */}
                <View style={styles.videoIndicator}>
                  <Text style={styles.videoIndicatorText}>🎥</Text>
                </View>
              </View>
            ) : (
              <View style={styles.documentIconContainer}>
                <Text style={styles.fileIcon}>{fileInfo.icon}</Text>
              </View>
            )}
          </View>
          
          {/* File info section */}
          <View style={styles.fileInfoSection}>
            <Text style={styles.fileName} numberOfLines={1}>
              {getDisplayFileName(file.name)}
            </Text>
            {file.size && (
              <Text style={styles.fileSize}>
                {formatFileSize(file.size)}
              </Text>
            )}
            {isPreviewable && (
              <Text style={styles.previewHint}>Tap to preview</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
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
        {/* Actions button - always show plus */}
        {!isBlocked && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShowActionsMenu}
          >
            <Plus size={24} color="#1C6B1C" />
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

      {/* File Viewer */}
      {showFileViewer && selectedFiles.length > 0 && (
        <FileViewerNative
          visible={showFileViewer}
          file={selectedFiles[selectedFileIndex]}
          files={selectedFiles}
          initialIndex={selectedFileIndex}
          onClose={() => {
            setShowFileViewer(false);
            setSelectedFileIndex(0);
          }}
        />
      )}
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
    marginLeft: 0,
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

  // File preview styles
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: 120,
    height: 140, // Added fixed height for more space
    position: 'relative',
  },
  filePreviewClickable: {
    borderColor: '#1C6B1C',
    borderWidth: 2,
  },
  removeFileButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  removeFileButtonInner: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  filePreviewContent: {
    flex: 1,
    alignItems: 'center',
  },
  mediaPreviewSection: {
    marginBottom: 12,
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  imageOverlayText: {
    fontSize: 8,
    color: 'white',
  },
  videoPreviewContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  videoIndicatorText: {
    fontSize: 10,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 18,
    marginLeft: 2, // Slight adjustment for visual centering
  },
  documentIconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileIcon: {
    fontSize: 28,
  },
  fileInfoSection: {
    alignItems: 'center',
    width: '100%',
  },
  fileName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 1,
  },
  previewHint: {
    fontSize: 8,
    color: '#1C6B1C',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});