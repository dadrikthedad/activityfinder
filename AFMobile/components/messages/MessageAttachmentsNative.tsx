// components/messages/MessageAttachmentsNative.tsx - Refactored with AttachmentPreview and AttachmentViewer
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Vibration,
  Clipboard,
} from 'react-native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { getFileTypeInfo, formatFileSize } from '@/utils/files/FileFunctions';
import DownloadProgressModal from '../files/DownloadProgressModal';
import { useDownload } from '@/hooks/files/useDownload';
import { File } from 'lucide-react-native';
import { ReactionMenuNative } from '../reactions/ReactionMenuNative';
import { useReactions } from '@/hooks/reactions/useReactions';
import { MessageDTO, ReactionDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { MessageCircleReply, Trash2, Clipboard as ClipboardIcon } from 'lucide-react-native';
import { Alert } from 'react-native';

// Import our new components
import { AttachmentPreview } from '../files/AttachmentPreview';
import useAttachmentViewer from '../files/AttachmentViewer';

interface MessageAttachmentsNativeProps {
  attachments: AttachmentDto[];
  isLocked?: boolean;
  isMapped?: boolean;
  // Reaction handler props
  message?: MessageDTO;
  currentUser?: UserSummaryDTO | null;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  onShowReactionUsers?: (emoji: string, reactions: ReactionDTO[]) => void;
}

interface DocumentAttachmentItemProps {
  attachment: AttachmentDto;
  index: number;
  totalCount: number;
  onPress: () => void;
  isLocked?: boolean;
  isMapped?: boolean;
  // Reaction handler props
  message?: MessageDTO;
  currentUser?: UserSummaryDTO | null;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  onShowReactionUsers?: (emoji: string, reactions: ReactionDTO[]) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const itemSize = Math.min((screenWidth - 32) / 1.5, 250);

// 🆕 NEW: Compact Document Attachment Component using AttachmentPreview
const DocumentAttachmentItem: React.FC<DocumentAttachmentItemProps> = ({ 
  attachment, 
  onPress, 
  isLocked = false,
  isMapped = false,
  totalCount,
  index,
  // Reaction handler props
  message,
  currentUser,
  onReply,
  onDelete,
  onShowUserPopover,
  onShowReactionUsers
}) => {
  const isOptimistic = attachment.isOptimistic;
  
  const showUploadStatus = Boolean(
    isOptimistic && 
    !isMapped && 
    (attachment.isUploading || attachment.uploadError)
  );

  // Check if we can use ReactionHandler
  const canUseReactionHandler = Boolean(
    message && 
    currentUser && 
    !message.isDeleted && 
    !isLocked && 
    !showUploadStatus
  );

  // State for reaction menu
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined>();
  
  const attachmentRef = useRef<View>(null);
  const { addReaction } = useReactions();

  // Handler for long press on attachment
  const handleLongPress = () => {
    if (!canUseReactionHandler) return;
    
    // Measure attachment position for menu
    attachmentRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setMenuPosition({ x: pageX, y: pageY, width, height });
    });

    // Haptic feedback
    if (Vibration) {
      Vibration.vibrate(50);
    }
    
    setShowReactionMenu(true);
    console.log('🔗 Long press on document attachment - showing reaction menu');
  };

  // Reaction and action handlers
  const handleReactionSelect = (emoji: string) => {
    if (!message || !currentUser) return;

    const actualMessageId = useChatStore.getState().getActualMessageId(message);
    if (!actualMessageId) {
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      return;
    }

    console.log(`💖 Adding reaction "${emoji}" to message from document attachment:`, {
      originalId: message.id,
      actualId: actualMessageId,
    });
 
    addReaction({
      messageId: actualMessageId,
      emoji
    });
    setShowReactionMenu(false);
  };

  const handleReply = () => {
    if (!message || !onReply) return;

    const actualMessageId = useChatStore.getState().getActualMessageId(message);
    if (!actualMessageId) {
      Alert.alert(
        "Please wait", 
        "Message is still being sent. Please try again in a moment.",
        [{ text: "OK" }]
      );
      return;
    }

    onReply(message);
    setShowReactionMenu(false);
  };

  const handleDelete = () => {
    if (!message || !onDelete) return;
    onDelete(message);
    setShowReactionMenu(false);
  };

  const handleCopyMessage = () => {
    if (!message?.text) {
      const fileName = attachment.fileName || 'Attachment';
      Clipboard.setString(fileName);
      console.log('📋 Copied document filename:', fileName);
    } else {
      Clipboard.setString(message.text);
      console.log('📋 Copied message text:', message.text.substring(0, 50) + '...');
    }
    setShowReactionMenu(false);
  };

  const getQuickActions = () => {
    const actions = [];
   
    if (message && onReply) {
      actions.push({
        type: 'reply' as const,
        label: 'Reply',
        icon: MessageCircleReply,
        onPress: handleReply,
        disabled: false,
      });
    }
   
    if (message && onDelete && currentUser?.id === message.sender?.id && !message.isDeleted) {
      actions.push({
        type: 'delete' as const,
        label: 'Delete',
        icon: Trash2,
        onPress: handleDelete,
        disabled: false,
        destructive: true,
      });
    }

    actions.push({
      type: 'copy' as const,
      label: 'Copy',
      icon: ClipboardIcon,
      onPress: handleCopyMessage,
      disabled: false,
    });
   
    return actions;
  };

  // Use AttachmentPreview with custom document styling
  const documentContent = (
    <TouchableOpacity
      ref={attachmentRef}
      style={styles.documentWrapper}
      onPress={onPress} // ✅ Use the onPress prop directly
      onLongPress={canUseReactionHandler ? handleLongPress : undefined}
      delayLongPress={500}
      activeOpacity={0.95}
      disabled={showUploadStatus}
    >
      <View style={[
        styles.documentContainer,
        showUploadStatus && styles.documentContainerUploading
      ]}>
        {/* Icon Section */}
        <View style={styles.documentIconSection}>
          <File size={24} color="#1C6B1C" />
        </View>

        {/* Content Section */}
        <View style={styles.documentContentSection}>
          <Text style={styles.documentName} numberOfLines={2}>
            {attachment.fileName ? decodeURIComponent(attachment.fileName) : 'Unnamed file'}
          </Text>
          <Text style={styles.documentType} numberOfLines={1}>
            {attachment.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
          </Text>
        </View>

        {/* Gallery indicator for documents (when multiple) */}
        {!showUploadStatus && totalCount > 1 && (
          <View style={styles.documentGalleryIndicator}>
            <Text style={styles.documentGalleryText}>{index + 1}/{totalCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Return with reaction menu if possible
  if (canUseReactionHandler) {
    return (
      <View style={styles.documentWithReactions}>
        {documentContent}
        
        <ReactionMenuNative
          visible={showReactionMenu}
          onClose={() => setShowReactionMenu(false)}
          onReactionSelect={handleReactionSelect}
          quickActions={getQuickActions()}
          existingReactions={message!.reactions || []}
          userId={currentUser!.id || 0}
          message={message}
          actualMessageId={useChatStore.getState().getActualMessageId(message!)}
          reactionsDisabled={false}
          actionsDisabled={false}
          messagePosition={menuPosition}
        />
      </View>
    );
  }

  return documentContent;
};

export default function MessageAttachmentsNative({ 
  attachments, 
  isLocked = false,
  isMapped = false,
  // Reaction handler props
  message,
  currentUser,
  onReply,
  onDelete,
  onShowUserPopover,
  onShowReactionUsers
}: MessageAttachmentsNativeProps) {
  const [blurredAttachments, setBlurredAttachments] = useState<Set<string>>(
    new Set(isLocked ? attachments
      .filter(att => {
        const info = getFileTypeInfo(att.fileType, att.fileName);
        return info.category === 'image' || info.category === 'video';
      })
      .map(att => att.fileUrl) : [])
  );

  // Use AttachmentViewer hook for file opening logic
  const { openFile } = useAttachmentViewer({
    attachments,
    isMapped
  });

  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Check if all attachments are documents
  const allAttachmentsAreDocuments = attachments.every(att => {
    const info = getFileTypeInfo(att.fileType, att.fileName);
    return info.category !== 'image' && info.category !== 'video';
  });

  const toggleBlur = (fileUrl: string) => {
    setBlurredAttachments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileUrl)) {
        newSet.delete(fileUrl);
      } else {
        newSet.add(fileUrl);
      }
      return newSet;
    });
  };

  const images = attachments.filter(att => 
    getFileTypeInfo(att.fileType, att.fileName).category === 'image'
  );
  const videos = attachments.filter(att => 
    getFileTypeInfo(att.fileType, att.fileName).category === 'video'
  );
  const documents = attachments.filter(att => {
    const category = getFileTypeInfo(att.fileType, att.fileName).category;
    return category !== 'image' && category !== 'video';
  });

  const handleAttachmentPress = (attachment: AttachmentDto, index: number) => {
    const showUploadStatus = Boolean(
      attachment.isOptimistic && 
      !isMapped && 
      (attachment.isUploading || attachment.uploadError)
    );
    
    if (showUploadStatus) {
      if (attachment.uploadError) {
        Alert.alert(
          'Upload Failed', 
          'This file failed to upload. Please try sending it again.',
          [{ text: 'OK' }]
        );
      }
      return;
    }
    
    const isCurrentlyBlurred = isLocked && blurredAttachments.has(attachment.fileUrl);
    
    if (isCurrentlyBlurred) {
      toggleBlur(attachment.fileUrl);
    } else {
      // Use AttachmentViewer to open the file
      openFile(index);
    }
  };

  // Reaction menu state for AttachmentPreview items
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    x: number; y: number; width: number; height: number;
  } | undefined>();
  const { addReaction } = useReactions();

  // Long press handler for reaction menu
  const createLongPressHandler = (attachment: AttachmentDto, index: number) => {
    const canUseReactionHandler = Boolean(
      message && 
      currentUser && 
      !message.isDeleted && 
      !isLocked && 
      !attachment.isUploading &&
      !attachment.uploadError
    );

    if (!canUseReactionHandler) return undefined;

    return () => {
      if (Vibration) {
        Vibration.vibrate(50);
      }
      setSelectedAttachmentIndex(index);
      setShowReactionMenu(true);
      console.log('🔗 Long press on attachment - showing reaction menu');
    };
  };

  // Reaction handlers for AttachmentPreview
  const handleReactionSelect = (emoji: string) => {
    if (!message || !currentUser) return;

    const actualMessageId = useChatStore.getState().getActualMessageId(message);
    if (!actualMessageId) {
      Alert.alert("Please wait", "Message is still being sent. Please try again in a moment.");
      return;
    }

    addReaction({ messageId: actualMessageId, emoji });
    setShowReactionMenu(false);
  };

  const handleReply = () => {
    if (!message || !onReply) return;
    onReply(message);
    setShowReactionMenu(false);
  };

  const handleDelete = () => {
    if (!message || !onDelete) return;
    onDelete(message);
    setShowReactionMenu(false);
  };

  const handleCopyMessage = () => {
    if (!message?.text) {
      const attachment = attachments[selectedAttachmentIndex];
      const fileName = attachment?.fileName || 'Attachment';
      Clipboard.setString(fileName);
    } else {
      Clipboard.setString(message.text);
    }
    setShowReactionMenu(false);
  };

  const getQuickActions = () => {
    const actions = [];
    if (message && onReply) {
      actions.push({
        type: 'reply' as const, label: 'Reply', icon: MessageCircleReply, 
        onPress: handleReply, disabled: false,
      });
    }
    if (message && onDelete && currentUser?.id === message.sender?.id && !message.isDeleted) {
      actions.push({
        type: 'delete' as const, label: 'Delete', icon: Trash2, 
        onPress: handleDelete, disabled: false, destructive: true,
      });
    }
    actions.push({
      type: 'copy' as const, label: 'Copy', icon: ClipboardIcon, 
      onPress: handleCopyMessage, disabled: false,
    });
    return actions;
  };

  const { 
    showProgress, 
    progress, 
    fileName, 
    cancelDownload 
  } = useDownload();

  const getFileTypesSummary = () => {
    const imageCount = images.length;
    const videoCount = videos.length;
    const docCount = documents.length;
    
    const parts = [];
    if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`);
    if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
    if (docCount > 0) parts.push(`${docCount} file${docCount !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  };

  // Render documents with compact layout if all are documents
  if (allAttachmentsAreDocuments) {
    return (
      <View style={styles.container}>
        <View style={styles.documentSection}>
          {attachments.length === 1 ? (
            // Single document - full width
            <DocumentAttachmentItem
              key={`single-document-${attachments[0].fileUrl}`}
              attachment={attachments[0]}
              index={0}
              totalCount={attachments.length}
              onPress={() => handleAttachmentPress(attachments[0], 0)}
              isLocked={isLocked}
              isMapped={isMapped}
              // Pass reaction handler props
              message={message}
              currentUser={currentUser}
              onReply={onReply}
              onDelete={onDelete}
              onShowUserPopover={onShowUserPopover}
              onShowReactionUsers={onShowReactionUsers}
            />
          ) : (
            // Multiple documents - horizontal scroll
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.documentHorizontalGrid}
              style={styles.documentHorizontalScroll}
            >
              {attachments.map((attachment, index) => (
                <DocumentAttachmentItem
                  key={`document-${index}-${attachment.fileUrl}`}
                  attachment={attachment}
                  index={index}
                  totalCount={attachments.length}
                  onPress={() => handleAttachmentPress(attachment, index)}
                  isLocked={isLocked}
                  isMapped={isMapped}
                  // Pass reaction handler props
                  message={message}
                  currentUser={currentUser}
                  onReply={onReply}
                  onDelete={onDelete}
                  onShowUserPopover={onShowUserPopover}
                  onShowReactionUsers={onShowReactionUsers}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {attachments.length > 5 && (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {attachments.length} files total {getFileTypesSummary()}
            </Text>
            <Text style={styles.summarySubtext}>
              Tap any file to view or download
            </Text>
          </View>
        )}

        <DownloadProgressModal
          visible={showProgress}                       
          fileName={fileName || ''}                           
          progress={progress?.progress || 0}                    
          totalBytes={progress?.totalBytesExpectedToWrite}       
          downloadedBytes={progress?.totalBytesWritten} 
          onCancel={cancelDownload}
        />
      </View>
    );
  }

  // Use original layout for mixed content or media-only with AttachmentPreview
  return (
    <View style={styles.container}>
      {attachments.length > 0 && (
        <View style={styles.section}>
          {attachments.length === 1 ? (
            <View style={styles.singleImageContainer}>
              {/* 🔧 FIX: Calculate upload status for single attachment */}
              {(() => {
                const attachment = attachments[0];
                const showUploadStatus = Boolean(
                  attachment.isOptimistic && 
                  !isMapped && 
                  (attachment.isUploading || attachment.uploadError)
                );

                return (
                  <AttachmentPreview
                    attachment={attachment}
                    index={0}
                    totalCount={attachments.length}
                    size="large"
                    showGalleryIndicator={attachments.length > 1}
                    showFileNameFooter={true}
                    onPress={() => handleAttachmentPress(attachment, 0)}
                    onLongPress={createLongPressHandler(attachment, 0)}
                    isBlurred={isLocked && blurredAttachments.has(attachment.fileUrl)}
                    isUploading={attachment.isUploading && showUploadStatus}
                    uploadError={showUploadStatus ? attachment.uploadError : null}
                    disabled={showUploadStatus}
                  />
                );
              })()}
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalGrid}
              style={styles.horizontalScroll}
            >
              {attachments.map((attachment, index) => {
                const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
                const isMedia = fileInfo.category === 'image' || fileInfo.category === 'video';
                const isCurrentlyBlurred = isLocked && isMedia && blurredAttachments.has(attachment.fileUrl);

                // 🔧 FIX: Calculate upload status properly
                const showUploadStatus = Boolean(
                  attachment.isOptimistic && 
                  !isMapped && 
                  (attachment.isUploading || attachment.uploadError)
                );

                return (
                  <AttachmentPreview
                    key={`combined-${index}-${attachment.fileUrl}`}
                    attachment={attachment}
                    index={index}
                    totalCount={attachments.length}
                    size="medium"
                    showGalleryIndicator={true}
                    showFileNameFooter={true}
                    onPress={() => handleAttachmentPress(attachment, index)}
                    onLongPress={createLongPressHandler(attachment, index)}
                    isBlurred={isCurrentlyBlurred}
                    isUploading={attachment.isUploading && showUploadStatus} // 🔧 FIX: Only show when actually uploading
                    uploadError={showUploadStatus ? attachment.uploadError : null} // 🔧 FIX: Only show error when uploading
                    disabled={showUploadStatus}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {attachments.length > 5 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {attachments.length} files total {getFileTypesSummary()}
          </Text>
          <Text style={styles.summarySubtext}>
            Tap any file to view or download
          </Text>
        </View>
      )}

      <DownloadProgressModal
        visible={showProgress}                       
        fileName={fileName || ''}                           
        progress={progress?.progress || 0}                    
        totalBytes={progress?.totalBytesExpectedToWrite}       
        downloadedBytes={progress?.totalBytesWritten} 
        onCancel={cancelDownload}
      />

      {/* Reaction Menu for AttachmentPreview items */}
      {showReactionMenu && message && currentUser && (
        <ReactionMenuNative
          visible={showReactionMenu}
          onClose={() => setShowReactionMenu(false)}
          onReactionSelect={handleReactionSelect}
          quickActions={getQuickActions()}
          existingReactions={message.reactions || []}
          userId={currentUser.id || 0}
          message={message}
          actualMessageId={useChatStore.getState().getActualMessageId(message)}
          reactionsDisabled={false}
          actionsDisabled={false}
          messagePosition={menuPosition}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  section: {
    marginBottom: 8,
  },
  // Document section styles
  documentSection: {
    gap: 8,
    marginBottom: 8,
  },
  documentWrapper: {
    // Wrapper for measuring
  },
  documentContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    padding: 12,
    alignItems: 'center',
    minHeight: 100,
    width: screenWidth - 130, // Full width for single document
    minWidth: Math.min(screenWidth - 150, 280), // Minimum width for scrolling documents
  },
  documentContainerUploading: {
    opacity: 0.7,
  },
  documentIconSection: {
    width: 48,
    height: 48,
    backgroundColor: '#ffffffff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentContentSection: {
    flex: 1,
    justifyContent: 'center',
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    lineHeight: 18,
  },
  documentType: {
    fontSize: 12,
    color: '#1C6B1C',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 2, // 🆕 NEW: Add margin for spacing
  },
  // 🆕 NEW: Document size styles
  documentSize: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
  },
  // Document gallery indicator styles
  documentGalleryIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  documentGalleryText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  documentWithReactions: {
    // Wrapper for document with reaction menu
  },
  // Document horizontal scroll styles
  documentHorizontalScroll: {
    marginHorizontal: -4,
  },
  documentHorizontalGrid: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
  summary: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  summarySubtext: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  horizontalScroll: {
    marginHorizontal: -4,
  },
  horizontalGrid: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
  singleImageContainer: {
    alignItems: 'center',
  },
});