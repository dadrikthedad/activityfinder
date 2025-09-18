// components/attachments/AttachmentPreview.tsx - Enhanced with thumbnail support
import React, { useRef, useMemo, useEffect, useState } from 'react';
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
import { RNFile, getFileTypeInfo, getDisplayFileName, formatFileSize } from '@/utils/files/FileFunctions';
import { VideoView, useVideoPlayer } from 'expo-video';
import { FileNameFooterPreview } from '../files/FileNameFooterPreview';
import { useLazyFileDecryption } from '@/features/cryptoAttachments/hooks/useLazyFileDecryption';
import * as FileSystem from 'expo-file-system';
import { NativeFileOpener } from '@/features/cryptoAttachments/utils/NativeFileOpener';
import { useDecryptionStore } from '@/features/crypto/store/useDecryptionStore';
import { generateCacheKey } from '@/features/crypto/storage/utils/cacheKeyUtils';
import { unifiedCacheManager } from '@/features/crypto/storage/UnifiedCacheManager';

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

  borderColor?: string;
}

// Video Preview Component for thumbnails
const VideoPreview: React.FC<{ uri: string; isBlurred?: boolean }> = ({ uri, isBlurred }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.muted = true;
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

// Enhanced size configurations
const getSizeConfig = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        containerSize: 100,
        iconSize: 24,
        fontSize: 9,
        maxNameLength: 15,
        documentPadding: 6,
      };
    case 'large':
      return {
        containerSize: Math.min((screenWidth - 32) / 1.5, 250),
        iconSize: 48,
        fontSize: 13,
        maxNameLength: 50,
        documentPadding: 16,
      };
    case 'medium':
    default:
      return {
        containerSize: 140,
        iconSize: 36,
        fontSize: 11,
        maxNameLength: 25,
        documentPadding: 12,
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
  borderColor = '#1C6B1C',
}) => {
  const attachmentRef = useRef<View>(null);
  const sizeConfig = getSizeConfig(size);
  const { decryptFile, isLoading: isDecryptingThumbnail, getDecryptedUrl } = useLazyFileDecryption();
  const hasAttemptedDecryption = useRef(new Set<string>());
  
  // Normalize data from either AttachmentDto or RNFile
  const normalizedData = attachment ? {
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileUrl: attachment.fileUrl,
    localUri: attachment.localUri,
    isOptimistic: attachment.isOptimistic,
    size: attachment.fileSize,
    // Thumbnail fields
    thumbnailUrl: attachment.thumbnailUrl,
    thumbnailWidth: attachment.thumbnailWidth,
    thumbnailHeight: attachment.thumbnailHeight,
    localThumbnailUri: attachment.localThumbnailUri,
    needsDecryption: attachment.needsDecryption,
  } : {
    fileName: file?.name || 'Unknown file',
    fileType: file?.type || 'application/octet-stream',
    fileUrl: file?.uri || '',
    localUri: file?.uri,
    isOptimistic: true,
    size: file?.size,
    thumbnailUrl: undefined,
    thumbnailWidth: undefined,
    thumbnailHeight: undefined,
    localThumbnailUri: undefined,
    needsDecryption: false,
  };

  const fileInfo = getFileTypeInfo(normalizedData.fileType, normalizedData.fileName);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video';
  const isDocument = !isImage && !isVideo;

  // State for thumbnail decryption
  const [thumbnailDecrypted, setThumbnailDecrypted] = useState(false);

  const thumbnailStoreUrl = useDecryptionStore(state =>
    normalizedData.thumbnailUrl ?
      state.getDecryptedUrl(generateCacheKey(normalizedData.thumbnailUrl)) :
      null
  );

  // Determine which image/video URI to use with thumbnail priority
  const displayUri = useMemo(() => {
  if (normalizedData.localThumbnailUri) {
    console.log('BANAN displayUri - using localThumbnailUri');
    return normalizedData.localThumbnailUri;
  }

  if (normalizedData.needsDecryption && normalizedData.thumbnailUrl) {
    const thumbnailCacheKey = normalizedData.thumbnailUrl ? generateCacheKey(normalizedData.thumbnailUrl) : null;
    const decryptedThumbnailUrl = thumbnailCacheKey ? getDecryptedUrl(thumbnailCacheKey) : null;
    
    if (decryptedThumbnailUrl) {
      console.log('BANAN displayUri - using decrypted thumbnail from UnifiedCacheManager');
      return decryptedThumbnailUrl;
    }
    
    // Sjekk UnifiedCacheManager direkte for cached thumbnail
    const cachedFromUnified = unifiedCacheManager.getCachedThumbnail(
      normalizedData.isOptimistic ? (normalizedData.localUri || '') : (normalizedData.fileUrl || ''),
      normalizedData.size
    );
    
    if (cachedFromUnified) {
      console.log('BANAN displayUri - using cached thumbnail from UnifiedCacheManager');
      return cachedFromUnified.uri;
    }

    console.log('BANAN displayUri - thumbnail decryption in progress');
    return null;
  }

  // Resten av logikken forblir det samme...
  if (normalizedData.thumbnailUrl && !normalizedData.needsDecryption) {
    console.log('BANAN displayUri - using plain thumbnail');
    return normalizedData.thumbnailUrl;
  }

  if (normalizedData.isOptimistic && normalizedData.localUri) {
    console.log('BANAN displayUri - using optimistic localUri');
    return normalizedData.localUri;
  }

  console.log('BANAN displayUri - using fallback fileUrl');
  return normalizedData.fileUrl;
}, [
  normalizedData.localThumbnailUri,
  normalizedData.needsDecryption,
  normalizedData.thumbnailUrl,
  normalizedData.fileUrl,
  normalizedData.size,
  normalizedData.isOptimistic,
  normalizedData.localUri,
  getDecryptedUrl,
  thumbnailStoreUrl,
]);

useEffect(() => {
  if (!attachment || !normalizedData.needsDecryption || !normalizedData.thumbnailUrl) return;
  if (!(isImage || isVideo)) return;
  if (displayUri) return; // Allerede tilgjengelig

  // Start dekryptering hvis ikke allerede i gang
  const thumbnailCacheKey = generateCacheKey(normalizedData.thumbnailUrl);
  if (!getDecryptedUrl(thumbnailCacheKey) && !isDecryptingThumbnail(thumbnailCacheKey)) {
    console.log(`🔐🖼️ Auto-starting thumbnail decryption for: ${normalizedData.fileName}`);
    
    const thumbnailAttachment: AttachmentDto = {
      fileUrl: normalizedData.thumbnailUrl,
      fileType: 'image/jpeg', // Thumbnails er alltid bilder
      fileName: `thumbnail_${normalizedData.fileName.replace(/\.[^.]+$/, '.jpg')}`, // Endre filtype til .jpg
      fileSize: undefined,
      isEncrypted: true,
      needsDecryption: true,
      keyInfo: attachment.thumbnailKeyInfo,
      iv: attachment.thumbnailIV,
      version: attachment.version || 1,
    };

    decryptFile(thumbnailAttachment);
  }
}, [attachment, displayUri, isImage, isVideo]);
  


// Behold useEffect #2 som den er (caching etter dekryptering)
 useEffect(() => {
  if (!attachment || !normalizedData.needsDecryption || !normalizedData.thumbnailUrl) return;

  const decryptedUrl = getDecryptedUrl(normalizedData.thumbnailUrl);
  if (decryptedUrl) {
    // Cache i UnifiedCacheManager
    const cacheKey = normalizedData.isOptimistic ? 
      normalizedData.localUri : 
      normalizedData.fileUrl;
      
    if (cacheKey) {
      unifiedCacheManager.cacheThumbnail(
        cacheKey,
        normalizedData.size,
        decryptedUrl,
        normalizedData.thumbnailWidth || 400,
        normalizedData.thumbnailHeight || 400
      );
      console.log(`Cached decrypted thumbnail in UnifiedCacheManager for ${normalizedData.fileName}`);
    }
  }
}, [
  attachment?.thumbnailUrl,
  attachment?.fileUrl,
  getDecryptedUrl
]);
  
  // Show upload status
  const showUploadStatus = Boolean(uploadError);

  // Erstatt isDecryptingFile prop med sanntids store data
  const decryptionProgress = useDecryptionStore(state => 
    state.getProgress(normalizedData.fileUrl)
  );
  const decryptionStatus = useDecryptionStore(state => 
    state.getStatus(normalizedData.fileUrl)
  );
  const isDecryptingFromStore = useDecryptionStore(state => 
    state.isDecrypting(normalizedData.fileUrl)
  );

  const { cancelDecryption } = useDecryptionStore();

  // Oppdater showFileDecryptionLoading logikk
  const showFileDecryptionLoading = (
    isDecryptingFromStore && 
    attachment?.needsDecryption && 
    !showUploadStatus
  );

  // Get file extension and formatted size
  const fileExtension = normalizedData.fileName?.split('.').pop()?.toUpperCase() || 'FILE';
  const formattedSize = normalizedData.size ? formatFileSize(normalizedData.size) : '';

  const handlePress = () => {
    if (disabled) return;
    
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

  // Determine if we should show a loading state for thumbnail
  const showThumbnailLoading = (
    normalizedData.needsDecryption &&
    normalizedData.thumbnailUrl &&
    !displayUri &&
    (isImage || isVideo)
  );

  return (
    <TouchableOpacity
      ref={attachmentRef}
      style={[
        styles.container,
        { 
          width: sizeConfig.containerSize, 
          height: sizeConfig.containerSize,
          borderColor: borderColor,
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
        <>
          {displayUri ? (
            
            <Image
              source={{ uri: displayUri }}
              style={[
                styles.image,
                isBlurred && styles.blurredImage,
                showUploadStatus && styles.uploadingImage
              ]}
              resizeMode="cover"
            />
          ) : showThumbnailLoading ? (
            <View style={styles.thumbnailLoadingContainer}>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.thumbnailLoadingText}>Loading preview...</Text>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageIcon}>🖼️</Text>
              <Text style={styles.placeholderText}>Image</Text>
            </View>
          )}
        </>
      )}

      {/* VIDEO CONTENT */}
      {/* VIDEO CONTENT - FIX: Bruk Image for thumbnail, ikke VideoPreview */}
        {isVideo && (
          <View style={styles.videoContainer}>
            {displayUri && !showUploadStatus ? (
              <Image
                source={{ uri: displayUri }}
                style={[
                  styles.videoPreview,
                  isBlurred && styles.blurredVideo
                ]}
                resizeMode="cover"
              />
            ) : showThumbnailLoading ? (
              <View style={[styles.videoPlaceholder, styles.thumbnailLoadingContainer]}>
                <ActivityIndicator size="small" color="white" />
                <Text style={[styles.thumbnailLoadingText, { color: 'white' }]}>Loading preview...</Text>
              </View>
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
        <View style={[styles.documentContainer, { padding: sizeConfig.documentPadding }]}>
          {/* Icon Section */}
          <View style={styles.documentIconSection}>
            <File size={sizeConfig.iconSize} color="#1C6B1C" />
          </View>
          
          {/* Info Section */}
          <View style={styles.documentInfoSection}>
            {/* File Name */}
            <Text 
              style={[
                styles.documentName, 
                { 
                  fontSize: sizeConfig.fontSize,
                  lineHeight: sizeConfig.fontSize + 2
                }
              ]} 
              numberOfLines={size === 'large' ? 4 : 3}
            >
              {decodeURIComponent(normalizedData.fileName || 'Unknown file')}
            </Text>
            
            {/* File Type and Size Row */}
            <View style={styles.documentMetaRow}>
              <Text 
                style={[
                  styles.documentType, 
                  { fontSize: sizeConfig.fontSize - 1 }
                ]} 
                numberOfLines={1}
              >
                {fileExtension}
              </Text>
              
              {/* File Size */}
              {formattedSize && (
                <>
                  <Text style={[styles.documentSeparator, { fontSize: sizeConfig.fontSize - 1 }]}>
                    •
                  </Text>
                  <Text 
                    style={[
                      styles.documentSize, 
                      { fontSize: sizeConfig.fontSize - 1 }
                    ]} 
                    numberOfLines={1}
                  >
                    {formattedSize}
                  </Text>
                </>
              )}
            </View>
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

       {showFileDecryptionLoading && (
        <View style={styles.decryptionOverlay}>
          <ActivityIndicator size="small" color="#1C6B1C" />
          <Text style={styles.decryptionText}>
            {decryptionStatus} {decryptionProgress}%
          </Text>
          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${decryptionProgress}%` }
                ]}
              />
            </View>
          </View>
          {cancelDecryption  && (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => cancelDecryption(normalizedData.fileUrl)}
            >
              <X size={16} color="white" />
            </TouchableOpacity>
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
          {isVideo && !isBlurred && displayUri && (
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
    overflow: 'visible',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
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
    elevation: 10,
    backgroundColor: 'transparent',
  },
  removeButtonInner: {
    backgroundColor: '#9CA3AF',
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
    borderRadius: 8,
  },
  blurredImage: {
    opacity: 0.3,
  },
  uploadingImage: {
    opacity: 0.8,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  imageIcon: {
    fontSize: 32,
  },
  
  // Video styles
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8
  },
  videoPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  blurredVideo: {
    opacity: 0.3,
    borderRadius: 8,
    overflow: 'hidden',
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
  
  // Thumbnail loading states
  thumbnailLoadingContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  thumbnailLoadingText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Document styles
  documentContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column',
    borderRadius: 8,
  },
  documentIconSection: {
    marginBottom: 8,
    flexShrink: 0,
  },
  documentInfoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  documentName: {
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 6,
    width: '100%',
  },
  documentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    width: '100%',
  },
  documentType: {
    color: '#1C6B1C',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  documentSeparator: {
    color: '#9CA3AF',
    marginHorizontal: 4,
    fontWeight: '500',
  },
  documentSize: {
    color: '#6B7280',
    textAlign: 'center',
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
    borderRadius: 8,
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
    borderRadius: 8,
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
    backgroundColor: '#1C6B1C',
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

  // Decryption
   decryptionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  decryptionText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  cancelButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  progressBarContainer: {
  width: '80%',
  marginTop: 8,
},
progressBar: {
  height: 3,
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  borderRadius: 1.5,
  overflow: 'hidden',
},
progressFill: {
  height: '100%',
  backgroundColor: '#1C6B1C',
  borderRadius: 1.5,
},
});