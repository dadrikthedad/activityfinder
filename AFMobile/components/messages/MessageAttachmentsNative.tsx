// components/messages/MessageAttachmentsNative.tsx - Updated for expo-video
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
  ScrollView
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
import { Play } from 'lucide-react-native';

interface MessageAttachmentsNativeProps {
  attachments: AttachmentDto[];
  isLocked?: boolean;
  isMapped?: boolean; 
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
}

const { width: screenWidth } = Dimensions.get('window');
const itemSize = Math.min((screenWidth - 32) / 1.5, 250); // Max 150px, responsive to screen

// Video Preview Component for thumbnails
const VideoPreview: React.FC<{ uri: string; isBlurred?: boolean }> = ({ uri, isBlurred }) => {
  // Create a player instance for video thumbnail
  const player = useVideoPlayer(uri, (player) => {
    player.muted = true; // Always muted for previews
    player.currentTime = 1; // Seek to 1 second for better thumbnail
    // Don't auto-play for previews
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
  totalCount
}: AttachmentItemNativeProps) => {
  const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video';

  const isOptimistic = attachment.isOptimistic;
  const imageUri = isOptimistic ? attachment.localUri : attachment.fileUrl;
  
  // 🔧 Vis upload status kun hvis optimistic OG ikke mapped ennå
  const showUploadStatus = Boolean(
    isOptimistic && 
    !isMapped && 
    (attachment.isUploading || attachment.uploadError)
  );

  // Image attachment
  if (isImage) {
    return (
      <TouchableOpacity
        style={[styles.imageContainer, { width: itemSize, height: itemSize }]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={showUploadStatus} // 🔧 Kun disable under upload, ikke etter mapping
      >
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            isBlurred && styles.blurredImage,
            showUploadStatus && styles.uploadingImage
          ]}
          resizeMode="cover"
        />
        
        {/* 🆕 Upload status overlay - kun vis hvis ikke mapped */}
        {showUploadStatus && (
          <View style={styles.uploadStatusOverlay}>
            {attachment.isUploading && (
              <>
                <ActivityIndicator size="small" color="#1C6B1C" />
                <Text style={styles.uploadStatusText}>Uploading...</Text>
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
        
        {/* 🔧 Show normal overlays when not uploading OR when mapped */}
        {!showUploadStatus && (
          <>
            {/* Blur overlay */}
            {isBlurred && (
              <View style={styles.blurOverlay}>
                <Text style={styles.blurText}>👁️</Text>
                <Text style={styles.blurSubtext}>Tap to view</Text>
              </View>
            )}

            {/* Gallery indicator */}
            {galleryInfo && !isBlurred && (
              <View style={styles.galleryIndicator}>
                <Text style={styles.galleryText}>{galleryInfo}</Text>
              </View>
            )}

            {/* File name overlay */}
            {attachment.fileName && !isBlurred && (
              <View style={styles.fileNameOverlay}>
                <Text style={styles.fileNameText} numberOfLines={1}>
                  {getDisplayFileName(attachment.fileName, 20)}
                </Text>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Video attachment - updated for expo-video
  if (isVideo) {
    const videoUri = imageUri;
    
    return (
      <TouchableOpacity
        style={[styles.imageContainer, { width: itemSize, height: itemSize }]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={showUploadStatus}
      >
        <View style={styles.videoContainer}>
          {/* Try to show first frame of video - only if we have a valid URI */}
          {!showUploadStatus && videoUri ? (
            <VideoPreview uri={videoUri} isBlurred={isBlurred} />
          ) : (
            // Only show placeholder if no video URI or uploading
            <View style={[styles.videoPlaceholder, isBlurred && styles.blurredVideo]}>
              <Text style={styles.videoIcon}>🎥</Text>
              <Text style={styles.placeholderText}>Video</Text>
            </View>
          )}
          
          {/* Upload status overlay */}
          {showUploadStatus && (
            <View style={styles.uploadStatusOverlay}>
              {attachment.isUploading && (
                <>
                  <ActivityIndicator size="small" color="#1C6B1C" />
                  <Text style={styles.uploadStatusText}>Uploading video...</Text>
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
          
          {/* Video overlays - only show if not uploading */}
          {!showUploadStatus && (
            <>
              {/* Blur overlay */}
              {isBlurred && (
                <View style={styles.blurOverlay}>
                  <Text style={styles.blurText}>🎬</Text>
                  <Text style={styles.blurSubtext}>Tap to view</Text>
                </View>
              )}

              {/* Play button overlay - always visible for videos */}
              {!isBlurred && (
                <View style={styles.playOverlay}>
                  <View style={styles.playButton}>
                    <Play size={20} color="white" fill="white" />
                  </View>
                </View>
              )}

              {/* Gallery indicator for multiple videos */}
              {galleryInfo && !isBlurred && (
                <View style={styles.galleryIndicator}>
                  <Text style={styles.galleryText}>{galleryInfo}</Text>
                </View>
              )}

              {/* File name overlay */}
              {attachment.fileName && !isBlurred && (
                <View style={styles.fileNameOverlay}>
                  <Text style={styles.fileNameText} numberOfLines={1}>
                    {getDisplayFileName(attachment.fileName, 20)}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Document/other file types
  // Document/other file types
return (
  <TouchableOpacity
    style={[
      styles.documentContainer,
      // 🆕 For horisontal scroll - fast width som media
      totalCount > 1 && styles.documentContainerHorizontal
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.documentIcon}>
      <Text style={styles.documentIconText}>{fileInfo.icon}</Text>
    </View>
    
    <View style={[
      styles.documentInfo,
      totalCount > 1 && styles.documentInfoHorizontal
    ]}>
      <Text style={[
        styles.documentName,
        totalCount > 1 && styles.documentNameHorizontal
      ]} numberOfLines={totalCount > 1 ? 3 : 2}>
        {attachment.fileName || 'Unnamed file'}
      </Text>
      <Text style={styles.documentType}>
        {attachment.fileType || 'Unknown type'}
      </Text>
    </View>
    
    {/* Gallery indicator for documents in horizontal scroll */}
    {galleryInfo && totalCount > 1 && (
      <View style={styles.documentGalleryIndicator}>
        <Text style={styles.galleryText}>{galleryInfo}</Text>
      </View>
    )}
    
    <View style={styles.documentIndicator}>
      <Text style={styles.documentIndicatorText}>📎</Text>
    </View>
  </TouchableOpacity>
);
};


export default function MessageAttachmentsNative({ 
  attachments, 
  isLocked = false,
  isMapped = false  
}: MessageAttachmentsNativeProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [selectedFileIndex] = useState<number>(-1);
  const [blurredAttachments, setBlurredAttachments] = useState<Set<string>>(
    // For locked conversations, start with all media blurred
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

  // Toggle blur for specific attachment
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

  // Categorize attachments
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

  // Handle attachment press
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
      // 🆕 Smart URI selection med mapping lookup
      const convertToRNFile = (att: AttachmentDto): RNFile => {
        let finalUri: string;
        
        if (att.isOptimistic && att.optimisticId) {
          // Sjekk om vi har en mappet server URL
          const mappedServerUrl = optimisticToServerAttachmentMap[att.optimisticId];
          
          if (mappedServerUrl) {
            // Bruk server URL hvis mappet
            finalUri = mappedServerUrl;
            console.log(`📎 Using mapped server URL for ${att.optimisticId}: ${mappedServerUrl}`);
          } else {
            // Fallback til local URI hvis ikke mappet ennå
            finalUri = att.localUri || att.fileUrl;
            console.log(`📱 Using local URI for unmapped attachment: ${finalUri}`);
          }
        } else {
          // Vanlige server attachments
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
      
      // Debug logging
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

  // Get file types summary
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
      {/* Images Grid */}
      {/* Combined Media ScrollView */}
{attachments.length > 0 && (
  <View style={styles.section}>
    {attachments.length === 1 ? (
      // Single attachment - full width display
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
        />
      </View>
    ) : (
      // Multiple attachments - horizontal scroll
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
            />
          );
        })}
      </ScrollView>
    )}
  </View>
)}

{/* Summary for many files - flytt dette under den kombinerte ScrollView */}
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

      {/* Download Progress Modal */}
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

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  section: {
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#1C6B1C',
    // 🆕 For horisontal scroll - fast width
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
  blurToggle: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    borderRadius: 4,
  },
  blurToggleText: {
    fontSize: 12,
  },
  fileNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fileNameText: {
    fontSize: 10,
    color: 'white',
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
    backgroundColor: '#1C6B1C',  // Grønn bakgrunn 🟢
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
  playIcon: {
    fontSize: 16,
  },
  moreOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  moreSubtext: {
    fontSize: 12,
    color: 'white',
    marginTop: 2,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentIcon: {
    marginRight: 12,
  },
  documentIconText: {
    fontSize: 24,
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  documentType: {
    fontSize: 12,
    color: '#6B7280',
  },
  documentIndicator: {
    padding: 4,
  },
  documentIndicatorText: {
    fontSize: 16,
    color: '#9CA3AF',
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
  uploadingDocument: {
    opacity: 0.8,
    backgroundColor: '#F3F4F6',
  },
  documentUploadStatus: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
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
    marginHorizontal: -4, // Kompenser for padding
  },
  horizontalGrid: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
  singleImageContainer: {
    alignItems: 'center',
  },
  documentContainerHorizontal: {
    width: itemSize,
    height: itemSize,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  documentInfoHorizontal: {
    flex: 1,
    marginRight: 0,
    marginTop: 8,
    alignItems: 'center',
  },
  documentNameHorizontal: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
  documentGalleryIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

