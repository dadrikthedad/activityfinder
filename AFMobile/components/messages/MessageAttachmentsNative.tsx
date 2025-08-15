// components/messages/MessageAttachmentsNative.tsx - Updated with full ReactionHandler support
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
  Vibration,
  Clipboard,
} from 'react-native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { 
  getFileTypeInfo, 
  getDisplayFileName,
  RNFile 
} from '@/utils/files/FileFunctions';
import DownloadProgressModal from '../files/DownloadProgressModal';
import { useDownload } from '@/hooks/files/useDownload';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigationProp } from '@/types/navigation';
import { useChatStore } from '@/store/useChatStore';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Play, MessageCircleReply, Trash2, Clipboard as ClipboardIcon } from 'lucide-react-native';
import { FileNameFooterPreview } from '../files/FileNameFooterPreview';
import { ReactionMenuNative } from '../reactions/ReactionMenuNative';
import { useReactions } from '@/hooks/reactions/useReactions';
import { MessageDTO, ReactionDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';

interface MessageAttachmentsNativeProps {
  attachments: AttachmentDto[];
  isLocked?: boolean;
  isMapped?: boolean;
  // Nye props for reaction handler
  message?: MessageDTO;
  currentUser?: UserSummaryDTO | null;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  onShowReactionUsers?: (emoji: string, reactions: ReactionDTO[]) => void;
}

interface AttachmentItemNativeProps {
  attachment: AttachmentDto;
  index: number;
  totalCount: number;
  onPress: () => void;
  isLocked?: boolean;
  isBlurred?: boolean;
  onToggleBlur?: () => void;
  galleryInfo?: string;
  isMapped?: boolean;
  // Nye props for reaction handler
  message?: MessageDTO;
  currentUser?: UserSummaryDTO | null;
  onReply?: (message: MessageDTO) => void;
  onDelete?: (message: MessageDTO) => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  onShowReactionUsers?: (emoji: string, reactions: ReactionDTO[]) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const itemSize = Math.min((screenWidth - 32) / 1.5, 250);

// Video Preview Component for thumbnails
const VideoPreview: React.FC<{ uri: string; isBlurred?: boolean }> = ({ uri, isBlurred }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.muted = true;
    player.currentTime = 1;
  });

  return (
    <VideoView
      style={[styles.videoPreview, isBlurred && styles.blurredVideo]}
      player={player}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      showsTimecodes={false}
      requiresLinearPlayback={false}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

const AttachmentItemNative = ({ 
  attachment, 
  onPress, 
  isLocked = false,
  isBlurred = false,
  onToggleBlur,
  galleryInfo,
  isMapped = false,
  totalCount,
  // Nye props
  message,
  currentUser,
  onReply,
  onDelete,
  onShowUserPopover,
  onShowReactionUsers
}: AttachmentItemNativeProps) => {
  const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video';

  const isOptimistic = attachment.isOptimistic;
  const imageUri = isOptimistic ? attachment.localUri : attachment.fileUrl;
  
  const showUploadStatus = Boolean(
    isOptimistic && 
    !isMapped && 
    (attachment.isUploading || attachment.uploadError)
  );

  // Sjekk om vi kan bruke ReactionHandler
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

  // Handler for lang trykk på attachment
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
    console.log('🔗 Long press on attachment - showing reaction menu');
  };

  // 🔧 FORBEDRET: Handler for reaction selection
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

    console.log(`💖 Adding reaction "${emoji}" to message from attachment:`, {
      originalId: message.id,
      actualId: actualMessageId,
    });
 
    addReaction({
      messageId: actualMessageId,
      emoji
    });
  };

  // 🔧 FORBEDRET: Reply handler
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

    console.log('💬 Replying to message from attachment:', {
      originalId: message.id,
      actualId: actualMessageId,
      hasText: Boolean(message.text),
      hasAttachments: Boolean(message.attachments?.length),
    });

    onReply(message);
    setShowReactionMenu(false); // Lukk menyen
  };

  // 🔧 FORBEDRET: Delete handler
  const handleDelete = () => {
    if (!message || !onDelete) return;

    console.log('🗑️ Deleting message from attachment:', {
      originalId: message.id,
      hasText: Boolean(message.text),
      hasAttachments: Boolean(message.attachments?.length),
    });

    onDelete(message);
    setShowReactionMenu(false); // Lukk menyen
  };

  // 🆕 NY: Copy message handler
  const handleCopyMessage = () => {
    if (!message?.text) {
      // Hvis ingen tekst, kopier filnavn eller annen relevant info
      const fileName = attachment.fileName || 'Attachment';
      Clipboard.setString(fileName);
      console.log('📋 Copied attachment filename:', fileName);
    } else {
      Clipboard.setString(message.text);
      console.log('📋 Copied message text:', message.text.substring(0, 50) + '...');
    }
    setShowReactionMenu(false);
  };

  // 🔧 FORBEDRET: Quick actions for attachment
  const getQuickActions = () => {
    const actions = [];
   
    // 🔧 ENDRET: Reply action for ALLE meldinger (både egne og andres)
    if (message && onReply) {
      actions.push({
        type: 'reply' as const,
        label: 'Reply',
        icon: MessageCircleReply,
        onPress: handleReply,
        disabled: false,
      });
    }
   
    // Delete action (kun for egne meldinger)  
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

    // 🆕 NY: Copy action (alltid tilgjengelig)
    actions.push({
      type: 'copy' as const,
      label: 'Copy',
      icon: ClipboardIcon,
      onPress: handleCopyMessage,
      disabled: false,
    });
   
    return actions;
  };

  const attachmentContent = (
    <TouchableOpacity
      ref={attachmentRef}
      style={[styles.imageContainer, { width: itemSize, height: itemSize }]}
      onPress={onPress}
      onLongPress={canUseReactionHandler ? handleLongPress : undefined}
      delayLongPress={500}
      activeOpacity={0.95}
      disabled={showUploadStatus}
    >
      {/* BILDE INNHOLD */}
      {isImage && (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            isBlurred && styles.blurredImage,
            showUploadStatus && styles.uploadingImage
          ]}
          resizeMode="cover"
        />
      )}

      {/* VIDEO INNHOLD */}
      {isVideo && (
        <View style={styles.videoContainer}>
          {!showUploadStatus && imageUri ? (
            <VideoPreview uri={imageUri} isBlurred={isBlurred} />
          ) : (
            <View style={[styles.videoPlaceholder, isBlurred && styles.blurredVideo]}>
              <Text style={styles.videoIcon}>🎥</Text>
              <Text style={styles.placeholderText}>Video</Text>
            </View>
          )}
        </View>
      )}

      {/* DOKUMENT INNHOLD */}
      {!isImage && !isVideo && (
        <View style={styles.documentContentContainer}>
          <View style={styles.documentIconCentered}>
            <Text style={styles.documentIconTextLarge}>{fileInfo.icon}</Text>
          </View>
          
          <View style={styles.documentInfoCentered}>
            <Text style={styles.documentNameCentered} numberOfLines={2}>
              {getDisplayFileName(attachment.fileName || 'Unnamed file', 15)}
            </Text>
            <Text style={styles.documentTypeCentered} numberOfLines={1}>
              {attachment.fileType?.split('/')[1] || 'file'}
            </Text>
          </View>
        </View>
      )}

      {/* FELLES OVERLAYS */}
      
      {/* Upload status overlay */}
      {showUploadStatus && (
        <View style={styles.uploadStatusOverlay}>
          {attachment.isUploading && (
            <>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.uploadStatusText}>
                {isVideo ? 'Uploading video...' : 'Uploading...'}
              </Text>
            </>
          )}
          {attachment.uploadError && (
            <>
              <Text style={styles.uploadErrorIcon}>❌</Text>
              <Text style={styles.uploadStatusText}>Upload failed</Text>
            </>
          )}
        </View>
      )}

      {/* Normal overlays - kun hvis ikke uploading */}
      {!showUploadStatus && (
        <>
          {/* Blur overlay */}
          {isBlurred && (
            <View style={styles.blurOverlay}>
              <Text style={styles.blurText}>
                {isVideo ? '🎬' : '👁️'}
              </Text>
              <Text style={styles.blurSubtext}>Tap to view</Text>
            </View>
          )}

          {/* Play button overlay - kun for videoer */}
          {isVideo && !isBlurred && (
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Play size={20} color="white" fill="white" />
              </View>
            </View>
          )}

          {/* Gallery indicator */}
          {galleryInfo && !isBlurred && (
            <View style={styles.galleryIndicator}>
              <Text style={styles.galleryText}>{galleryInfo}</Text>
            </View>
          )}
          
          {/* FELLES FileNameFooterPreview */}
          <FileNameFooterPreview 
            fileName={attachment.fileName} 
            maxLength={40}
            isBlurred={isBlurred} 
          />
        </>
      )}
    </TouchableOpacity>
  );

  // Returner attachment content med reaction menu hvis mulig
  if (canUseReactionHandler) {
    return (
      <View style={styles.attachmentWithReactions}>
        {attachmentContent}
        
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

  // Returner bare innholdet uten ReactionHandler
  return attachmentContent;
};

export default function MessageAttachmentsNative({ 
  attachments, 
  isLocked = false,
  isMapped = false,
  // Nye props
  message,
  currentUser,
  onReply,
  onDelete,
  onShowUserPopover,
  onShowReactionUsers
}: MessageAttachmentsNativeProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [selectedFileIndex] = useState<number>(-1);
  const [blurredAttachments, setBlurredAttachments] = useState<Set<string>>(
    new Set(isLocked ? attachments
      .filter(att => {
        const info = getFileTypeInfo(att.fileType, att.fileName);
        return info.category === 'image' || info.category === 'video';
      })
      .map(att => att.fileUrl) : [])
  );

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const optimisticToServerAttachmentMap = useChatStore(state => state.optimisticToServerAttachmentMap);

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
      const convertToRNFile = (att: AttachmentDto): RNFile => {
        let finalUri: string;
        
        if (att.isOptimistic && att.optimisticId) {
          const mappedServerUrl = optimisticToServerAttachmentMap[att.optimisticId];
          
          if (mappedServerUrl) {
            finalUri = mappedServerUrl;
            console.log(`📎 Using mapped server URL for ${att.optimisticId}: ${mappedServerUrl}`);
          } else {
            finalUri = att.localUri || att.fileUrl;
            console.log(`📱 Using local URI for unmapped attachment: ${finalUri}`);
          }
        } else {
          finalUri = att.fileUrl;
        }
        
        return {
          uri: finalUri,
          type: att.fileType,
          name: att.fileName || 'unknown',
          size: undefined,
        };
      };
      
      const allRNFiles = attachments.map(convertToRNFile);
      
      console.log('🎬 Opening MediaViewer with files:', allRNFiles.map(f => ({
        name: f.name,
        uri: f.uri.substring(0, 50) + '...'
      })));
      
      navigation.navigate('MediaViewer', {
        files: allRNFiles,
        initialIndex: index,
        conversationId: undefined
      });
    }
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

  return (
    <View style={styles.container}>
      {attachments.length > 0 && (
        <View style={styles.section}>
          {attachments.length === 1 ? (
            <View style={styles.singleImageContainer}>
              <AttachmentItemNative
                key={`single-${attachments[0].fileUrl}`}
                attachment={attachments[0]}
                index={0}
                totalCount={attachments.length}
                onPress={() => handleAttachmentPress(attachments[0], 0)}
                isLocked={isLocked}
                isBlurred={isLocked && blurredAttachments.has(attachments[0].fileUrl)}
                onToggleBlur={() => toggleBlur(attachments[0].fileUrl)}
                galleryInfo={attachments.length > 1 ? `1/${attachments.length}` : undefined}
                isMapped={isMapped}
                // 🔧 FORBEDRET: Pass alle reaction handler props
                message={message}
                currentUser={currentUser}
                onReply={onReply}
                onDelete={onDelete}
                onShowUserPopover={onShowUserPopover}
                onShowReactionUsers={onShowReactionUsers}
              />
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
                const galleryInfo = `${index + 1}/${attachments.length}`;

                return (
                  <AttachmentItemNative
                    key={`combined-${index}-${attachment.fileUrl}`}
                    attachment={attachment}
                    index={index}
                    totalCount={attachments.length}
                    onPress={() => handleAttachmentPress(attachment, index)}
                    isLocked={isLocked}
                    isBlurred={isCurrentlyBlurred}
                    onToggleBlur={() => toggleBlur(attachment.fileUrl)}
                    galleryInfo={galleryInfo}
                    isMapped={isMapped}
                    // 🔧 FORBEDRET: Pass alle reaction handler props
                    message={message}
                    currentUser={currentUser}
                    onReply={onReply}
                    onDelete={onDelete}
                    onShowUserPopover={onShowUserPopover}
                    onShowReactionUsers={onShowReactionUsers}
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
    </View>
  );
}

// Styles forblir de samme
const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  section: {
    marginBottom: 8,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#1C6B1C',
    minWidth: itemSize,
    minHeight: itemSize,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.3,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurText: {
    fontSize: 24,
    marginBottom: 4,
  },
  blurSubtext: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  galleryIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  galleryText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurredVideo: {
    opacity: 0.3,
  },
  videoIcon: {
    fontSize: 32,
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
    backgroundColor: '#1C6B1C',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  uploadStatusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadStatusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  uploadErrorIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  uploadingImage: {
    opacity: 0.8,
  },
  videoPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 4,
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
  documentContentContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  documentIconCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  documentIconTextLarge: {
    fontSize: 40,
    opacity: 0.8,
  },
  documentInfoCentered: {
    paddingHorizontal: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  documentNameCentered: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 13,
    marginBottom: 2,
  },
  documentTypeCentered: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  attachmentWithReactions: {
    // Wrapper for attachment with reaction menu
  },
});