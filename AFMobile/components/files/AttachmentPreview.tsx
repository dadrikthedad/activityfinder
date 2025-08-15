// components/attachments/AttachmentPreview.tsx - Reusable attachment preview component
import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { X, Play, File } from 'lucide-react-native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo, getDisplayFileName } from '@/utils/files/FileFunctions';
import { VideoView, useVideoPlayer } from 'expo-video';
import { FileNameFooterPreview } from '../files/FileNameFooterPreview';

const { width: screenWidth } = Dimensions.get('window');

export interface AttachmentPreviewProps {
  // Core data - support both AttachmentDto and RNFile
  attachment?: AttachmentDto;
  file?: RNFile;
  
  // Display options
  index?: number;
  totalCount?: number;
  size?: 'small' | 'medium' | 'large';
  showRemoveButton?: boolean;
  showGalleryIndicator?: boolean;
  showFileNameFooter?: boolean;
  
  // Interaction handlers
  onPress: () => void;
  onRemove?: () => void;
  onLongPress?: () => void;
  
  // Visual states
  isBlurred?: boolean;
  isUploading?: boolean;
  uploadError?: string | null;
  disabled?: boolean;
}

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

// Size configurations
const getSizeConfig = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        containerSize: 100,
        iconSize: 32,
        fontSize: 10,
        maxNameLength: 12,
      };
    case 'large':
      return {
        containerSize: Math.min((screenWidth - 32) / 1.5, 250),
        iconSize: 40,
        fontSize: 11,
        maxNameLength: 40,
      };
    case 'medium':
    default:
      return {
        containerSize: 140,
        iconSize: 36,
        fontSize: 11,
        maxNameLength: 15,
      };
  }
};

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  file,
  index = 0,
  totalCount = 1,
  size = 'medium',
  showRemoveButton = false,
  showGalleryIndicator = false,
  showFileNameFooter = false,
  onPress,
  onRemove,
  onLongPress,
  isBlurred = false,
  isUploading = false,
  uploadError = null,
  disabled = false,
}) => {
  const attachmentRef = useRef<View>(null);
  const sizeConfig = getSizeConfig(size);
  
  // Normalize data from either AttachmentDto or RNFile
  const normalizedData = attachment ? {
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileUrl: attachment.fileUrl,
    localUri: attachment.localUri,
    isOptimistic: attachment.isOptimistic,
    size: attachment.fileSize, // File size from attachment
  } : {
    fileName: file?.name || 'Unknown file',
    fileType: file?.type || 'application/octet-stream',
    fileUrl: file?.uri || '',
    localUri: file?.uri,
    isOptimistic: true,
    size: file?.size, // File size from file
  };

  const fileInfo = getFileTypeInfo(normalizedData.fileType, normalizedData.fileName);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video';
  const isDocument = !isImage && !isVideo;

  // Determine image URI
  const imageUri = normalizedData.isOptimistic ? normalizedData.localUri : normalizedData.fileUrl;
  
  // Show upload status
  const showUploadStatus = Boolean(isUploading || uploadError);

  const handlePress = () => {
    if (disabled || showUploadStatus) return;
    
    if (isBlurred) {
      // Handle blur toggle if needed
      return;
    }
    
    onPress();
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    }
  };

  const handleLongPress = () => {
    if (disabled || showUploadStatus) return;
    if (onLongPress) {
      onLongPress();
    }
  };

  return (
    <TouchableOpacity
      ref={attachmentRef}
      style={[
        styles.container,
        { 
          width: sizeConfig.containerSize, 
          height: sizeConfig.containerSize 
        },
        disabled && styles.containerDisabled
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      activeOpacity={0.95}
      disabled={disabled || showUploadStatus}
    >
      {/* Remove button */}
      {showRemoveButton && onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemove}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <View style={styles.removeButtonInner}>
            <X size={12} color="white" />
          </View>
        </TouchableOpacity>
      )}

      {/* IMAGE CONTENT */}
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

      {/* VIDEO CONTENT */}
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

      {/* DOCUMENT CONTENT */}
      {isDocument && (
        <View style={styles.documentContainer}>
          <View style={styles.documentIconSection}>
            <File size={sizeConfig.iconSize} color="#6B7280" />
          </View>
          
          <View style={styles.documentInfoSection}>
            <Text style={[styles.documentName, { fontSize: sizeConfig.fontSize }]} numberOfLines={2}>
              {getDisplayFileName(decodeURIComponent(normalizedData.fileName), sizeConfig.maxNameLength)}
            </Text>
            <Text style={[styles.documentType, { fontSize: sizeConfig.fontSize - 1 }]} numberOfLines={1}>
              {normalizedData.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
            </Text>
          </View>
        </View>
      )}
      
      {/* Upload status overlay */}
      {showUploadStatus && (
        <View style={styles.uploadStatusOverlay}>
          {isUploading && (
            <>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.uploadStatusText}>
                {isVideo ? 'Uploading video...' : 'Uploading...'}
              </Text>
            </>
          )}
          {uploadError && (
            <>
              <Text style={styles.uploadErrorIcon}>❌</Text>
              <Text style={styles.uploadStatusText}>Upload failed</Text>
            </>
          )}
        </View>
      )}

      {/* Overlays - only if not uploading */}
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

          {/* Play button overlay - only for videos */}
          {isVideo && !isBlurred && (
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Play size={20} color="white" fill="white" />
              </View>
            </View>
          )}

          {/* Gallery indicator */}
          {showGalleryIndicator && totalCount > 1 && (
            <View style={styles.galleryIndicator}>
              <Text style={styles.galleryText}>{index + 1}/{totalCount}</Text>
            </View>
          )}
          
          {/* File name footer for media files */}
          {showFileNameFooter && (isImage || isVideo) && (
            <FileNameFooterPreview 
              fileName={normalizedData.fileName}
              fileSize={normalizedData.size}
              maxLength={sizeConfig.maxNameLength}
              isBlurred={isBlurred}
              showSize={true}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#1C6B1C',
    position: 'relative',
  },
  containerDisabled: {
    opacity: 0.5,
  },
  
  // Remove button
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  removeButtonInner: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  
  // Image styles
  image: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.3,
  },
  uploadingImage: {
    opacity: 0.8,
  },
  
  // Video styles
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
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
  placeholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 4,
  },
  
  // Document styles
  documentContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  documentIconSection: {
    marginBottom: 8,
  },
  documentInfoSection: {
    alignItems: 'center',
    width: '100%',
  },
  documentName: {
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 2,
  },
  documentType: {
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  
  // Overlay styles
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
});