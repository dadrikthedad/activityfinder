// components/messages/MessageAttachmentsNative.tsx - Refactored to use AttachmentViewer
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Vibration,
  Clipboard,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { getFileTypeInfo } from '@/utils/files/FileFunctions';
import DownloadProgressModal from '../files/DownloadProgressModal';
import { useDownload } from '@/hooks/files/useDownload';
import { ReactionMenuNative } from '../reactions/ReactionMenuNative';
import { useReactions } from '@/hooks/reactions/useReactions';
import { MessageDTO, ReactionDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { MessageCircleReply, Trash2, Clipboard as ClipboardIcon } from 'lucide-react-native';

// Import our new AttachmentViewer component
import { createAttachmentPressHandler } from '@/features/cryptoAttachments/Viewer/comp/AttachmentGridMessages';
import { AttachmentPreview } from '../files/AttachmentPreview';
import { useEncryptedAttachmentOpener } from '@/features/cryptoAttachments/Viewer/hooks/useEncryptedAttachmentOpener';

interface MessageAttachmentsNativeProps {
  attachments: AttachmentDto[];
  isLocked?: boolean;
  isMapped?: boolean;
  // Reaction handler props
  message?: MessageDTO;
  currentUser?: UserSummaryDTO | null;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onShowReactionUsers?: (emoji: string, reactions: ReactionDTO[]) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function MessageAttachmentsNative({ 
  attachments, 
  isLocked = false,
  isMapped = false,
  // Reaction handler props
  message,
  currentUser,
  onReply,
  onDelete,
}: MessageAttachmentsNativeProps) {
  const [blurredAttachments, setBlurredAttachments] = useState<Set<string>>(
    new Set(isLocked ? attachments
      .filter(att => {
        const info = getFileTypeInfo(att.fileType, att.fileName);
        return info.category === 'image' || info.category === 'video';
      })
      .map(att => att.fileUrl) : [])
  );

  const setSearchMode = useChatStore(state => state.setSearchMode);

  const { openFile } = useEncryptedAttachmentOpener({
    attachments,
    isMapped,
    viewerOptions: {},
  });

  // Reaction menu state
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    x: number; y: number; width: number; height: number;
  } | undefined>();
  const { addReaction } = useReactions();

  // Create attachment press handler using the hook
  const attachmentPressHandler = createAttachmentPressHandler();

  if (!attachments || attachments.length === 0) {
    return null;
  }

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

  // Custom attachment press handler that handles blur and reactions
  const handleCustomAttachmentPress = async (index: number) => {
    const attachment = attachments[index];
    
    // Check upload status
    const showUploadStatus = Boolean(
      attachment.isOptimistic && 
      (attachment.uploadError)
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
    
    // Check if currently blurred
    const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
    const isMedia = fileInfo.category === 'image' || fileInfo.category === 'video';
    const isCurrentlyBlurred = isLocked && isMedia && blurredAttachments.has(attachment.fileUrl);
    
    if (isCurrentlyBlurred) {
      toggleBlur(attachment.fileUrl);
      return;
    }

    // Use the hook's press handler for file opening
    await openFile(index);
  };

  // Long press handler for reaction menu
  const createLongPressHandler = (attachment: AttachmentDto, index: number) => {
    const showUploadStatus = Boolean(
      attachment.isOptimistic && 
      !isMapped && 
      (attachment.isUploading || attachment.uploadError)
    );

    const canUseReactionHandler = Boolean(
      message && 
      currentUser && 
      !message.isDeleted && 
      !isLocked && 
      !showUploadStatus
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

  // Reaction handlers
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
    setSearchMode(false);
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
    
    const imageCount = images.length;
    const videoCount = videos.length;
    const docCount = documents.length;
    
    const parts = [];
    if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`);
    if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
    if (docCount > 0) parts.push(`${docCount} file${docCount !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  };

  // Use existing layout for all attachments
  return (
  <View style={styles.attachmentsWrapper}>
    <View style={styles.attachmentsContent}>
      {attachments.length === 1 ? (
        // Single attachment - full width
        <View style={styles.singleAttachmentContainer}>
          {(() => {
            const attachment = attachments[0];
            const showUploadStatus = Boolean(
              attachment.isOptimistic && 
              !isMapped && 
              (attachment.isUploading || attachment.uploadError)
            );
            const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
            const isMedia = fileInfo.category === 'image' || fileInfo.category === 'video';

            return (
              <AttachmentPreview
                attachment={attachment}
                index={0}
                totalCount={attachments.length}
                size="large"
                showGalleryIndicator={false}
                showFileNameFooter={isMedia}
                onPress={() => handleCustomAttachmentPress(0)}
                onLongPress={createLongPressHandler(attachment, 0)}
                isBlurred={isLocked && isMedia && blurredAttachments.has(attachment.fileUrl)}
                isUploading={attachment.isUploading && showUploadStatus}
                uploadError={showUploadStatus ? attachment.uploadError : null}
                disabled={showUploadStatus}
              />
            );
          })()}
        </View>
      ) : (
        // Multiple attachments - horizontal scroll (works for any number of files)
        <View style={styles.multipleAttachmentsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalGrid}
            style={styles.horizontalScroll}
            nestedScrollEnabled={true}
          >
            {attachments.map((attachment, index) => {
              const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
              const isMedia = fileInfo.category === 'image' || fileInfo.category === 'video';
              const isCurrentlyBlurred = isLocked && isMedia && blurredAttachments.has(attachment.fileUrl);

              const showUploadStatus = Boolean(
                attachment.isOptimistic && 
                !isMapped && 
                (attachment.isUploading || attachment.uploadError)
              );

              return (
                <AttachmentPreview
                  key={`attachment-${index}-${attachment.fileUrl}`}
                  attachment={attachment}
                  index={index}
                  totalCount={attachments.length}
                  size="medium"
                  showGalleryIndicator={true}
                  showFileNameFooter={isMedia}
                  onPress={() => handleCustomAttachmentPress(index)}
                  onLongPress={createLongPressHandler(attachment, index)}
                  isBlurred={isCurrentlyBlurred}
                  isUploading={attachment.isUploading && showUploadStatus}
                  uploadError={showUploadStatus ? attachment.uploadError : null}
                  disabled={showUploadStatus}
                />
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>

    {/* Summary for many files */}
    {attachments.length > 5 && (
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {attachments.length} files total {getFileTypesSummary()}
        </Text>
      </View>
    )}

    {/* Download Progress Modal */}
    <DownloadProgressModal
      visible={showProgress}                       
      fileName={fileName || ''}                           
      progress={progress?.progress || 0}                    
      totalBytes={progress?.totalBytesExpectedToWrite}       
      downloadedBytes={progress?.totalBytesWritten} 
      onCancel={cancelDownload}
    />

    {/* Reaction Menu */}
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
  attachmentsWrapper: {
    // Hovedcontainer
  },
  attachmentsContent: {
    alignSelf: 'flex-start',
    width: '100%',
  },
  singleAttachmentContainer: {
    alignItems: 'center',
  },
  multipleAttachmentsContainer: {
    // Container for horizontal scroll of multiple attachments
  },
  horizontalScroll: {
    marginHorizontal: -4,
  },
  horizontalGrid: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  attachmentViewerContainer: {
    // Styling for the new AttachmentViewer component
    marginTop: 4,
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
});