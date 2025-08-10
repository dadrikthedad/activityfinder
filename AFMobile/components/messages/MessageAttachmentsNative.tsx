// components/messages/MessageAttachmentsNative.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert
} from 'react-native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { 
  getFileTypeInfo, 
  formatFileSize, 
  getDisplayFileName,
  RNFile 
} from '@/utils/files/FileFunctions';
import FileViewerNative from '../files/FileViewerNative';
import { shareRNFile  } from '../files/FileHandlerNative';
import DownloadProgressModal from '../files/DownloadProgressModal';
import { useDownload } from '@/hooks/files/useDownload';


interface MessageAttachmentsNativeProps {
  attachments: AttachmentDto[];
  isLocked?: boolean;
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
}

const { width: screenWidth } = Dimensions.get('window');
const itemSize = Math.min((screenWidth - 64) / 2, 150); // Max 150px, responsive to screen

const AttachmentItemNative = ({ 
  attachment, 
  index, 
  onPress, 
  isLocked = false,
  isBlurred = false,
  onToggleBlur,
  galleryInfo
}: AttachmentItemNativeProps) => {
  const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
  const isImage = fileInfo.category === 'image';
  const isVideo = fileInfo.category === 'video';

  // Image attachment
  if (isImage) {
    return (
      <TouchableOpacity
        style={[styles.imageContainer, { width: itemSize, height: itemSize }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: attachment.fileUrl }}
          style={[
            styles.image,
            isBlurred && styles.blurredImage
          ]}
          resizeMode="cover"
        />
        
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

        {/* Blur toggle button for locked conversations */}
        {isLocked && !isBlurred && (
          <TouchableOpacity
            style={styles.blurToggle}
            onPress={(e) => {
              e.stopPropagation();
              onToggleBlur?.();
            }}
          >
            <Text style={styles.blurToggleText}>🙈</Text>
          </TouchableOpacity>
        )}

        {/* File name overlay */}
        {attachment.fileName && !isBlurred && (
          <View style={styles.fileNameOverlay}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {getDisplayFileName(attachment.fileName, 20)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Video attachment
  if (isVideo) {
    return (
      <TouchableOpacity
        style={[styles.imageContainer, { width: itemSize, height: itemSize }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.videoContainer}>
          {/* Video thumbnail or placeholder */}
          <View style={[styles.videoPlaceholder, isBlurred && styles.blurredVideo]}>
            <Text style={styles.videoIcon}>🎥</Text>
          </View>
          
          {/* Blur overlay for videos */}
          {isBlurred && (
            <View style={styles.blurOverlay}>
              <Text style={styles.blurText}>🎬</Text>
              <Text style={styles.blurSubtext}>Tap to view</Text>
            </View>
          )}

          {/* Play button overlay */}
          {!isBlurred && (
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Text style={styles.playIcon}>▶️</Text>
              </View>
            </View>
          )}

          {/* Blur toggle for locked conversations */}
          {isLocked && !isBlurred && (
            <TouchableOpacity
              style={styles.blurToggle}
              onPress={(e) => {
                e.stopPropagation();
                onToggleBlur?.();
              }}
            >
              <Text style={styles.blurToggleText}>🙈</Text>
            </TouchableOpacity>
          )}

          {/* File name */}
          {attachment.fileName && !isBlurred && (
            <View style={styles.fileNameOverlay}>
              <Text style={styles.fileNameText} numberOfLines={1}>
                {getDisplayFileName(attachment.fileName, 20)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Document/other file types
  return (
    <TouchableOpacity
      style={styles.documentContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.documentIcon}>
        <Text style={styles.documentIconText}>{fileInfo.icon}</Text>
      </View>
      
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={2}>
          {attachment.fileName || 'Unnamed file'}
        </Text>
        <Text style={styles.documentType}>
          {attachment.fileType || 'Unknown type'}
        </Text>
      </View>
      
      <View style={styles.documentIndicator}>
        <Text style={styles.documentIndicatorText}>📎</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function MessageAttachmentsNative({ 
  attachments, 
  isLocked = false 
}: MessageAttachmentsNativeProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
  const [showViewer, setShowViewer] = useState(false);
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

  // Convert AttachmentDto to RNFile format
  const convertToRNFile = (attachment: AttachmentDto): RNFile => ({
    uri: attachment.fileUrl,
    type: attachment.fileType,
    name: attachment.fileName || 'unknown',
    size: undefined, // Size not available in AttachmentDto
  });

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
    const isCurrentlyBlurred = isLocked && blurredAttachments.has(attachment.fileUrl);
    
    if (isCurrentlyBlurred) {
      // If blurred, just unblur it
      toggleBlur(attachment.fileUrl);
    } else {
      // Open viewer
      setSelectedFileIndex(index);
      setShowViewer(true);
    }
  };

  // Get current file for viewer
  const selectedFile = selectedFileIndex >= 0 ? convertToRNFile(attachments[selectedFileIndex]) : null;
  const allRNFiles = attachments.map(convertToRNFile);

  const { 
    showProgress, 
    progress, 
    fileName, 
    downloadFile, 
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


const handleDownload = async (file: RNFile) => {
  const result = await downloadFile(file.uri, file.name);
  if (result) {
    // Success - fil er lastet ned
    console.log('Downloaded to:', result);
  }
  // Cancellation og errors håndteres automatisk av hooken
};


  const handleShare = async (file: RNFile) => {
    try {
      await shareRNFile(file);
    } catch (error) {
      console.error('Deling feilet:', error);
      Alert.alert('Feil', 'Kunne ikke dele filen');
    }
  };


  return (
    <View style={styles.container}>
      {/* Images Grid */}
      {images.length > 0 && (
        <View style={styles.section}>
          <View style={styles.grid}>
            {images.slice(0, 4).map((attachment, index) => {
              const globalIndex = attachments.indexOf(attachment);
              const isCurrentlyBlurred = isLocked && blurredAttachments.has(attachment.fileUrl);
              const galleryInfo = images.length > 1 ? `${index + 1}/${images.length}` : undefined;

              return (
                <AttachmentItemNative
                  key={`image-${globalIndex}`}
                  attachment={attachment}
                  index={globalIndex}
                  totalCount={images.length}
                  onPress={() => handleAttachmentPress(attachment, globalIndex)}
                  isLocked={isLocked}
                  isBlurred={isCurrentlyBlurred}
                  onToggleBlur={() => toggleBlur(attachment.fileUrl)}
                  galleryInfo={galleryInfo}
                />
              );
            })}
            
            {/* Show +X more overlay */}
            {images.length > 4 && (
              <TouchableOpacity
                style={[styles.imageContainer, styles.moreOverlay, { width: itemSize, height: itemSize }]}
                onPress={() => handleAttachmentPress(images[4], attachments.indexOf(images[4]))}
              >
                <Text style={styles.moreText}>+{images.length - 4}</Text>
                <Text style={styles.moreSubtext}>more</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Videos Grid */}
      {videos.length > 0 && (
        <View style={styles.section}>
          <View style={styles.grid}>
            {videos.map((attachment, index) => {
              const globalIndex = attachments.indexOf(attachment);
              const isCurrentlyBlurred = isLocked && blurredAttachments.has(attachment.fileUrl);

              return (
                <AttachmentItemNative
                  key={`video-${globalIndex}`}
                  attachment={attachment}
                  index={globalIndex}
                  totalCount={videos.length}
                  onPress={() => handleAttachmentPress(attachment, globalIndex)}
                  isLocked={isLocked}
                  isBlurred={isCurrentlyBlurred}
                  onToggleBlur={() => toggleBlur(attachment.fileUrl)}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <View style={styles.section}>
          {documents.map((attachment, index) => {
            const globalIndex = attachments.indexOf(attachment);
            
            return (
              <AttachmentItemNative
                key={`doc-${globalIndex}`}
                attachment={attachment}
                index={globalIndex}
                totalCount={documents.length}
                onPress={() => handleAttachmentPress(attachment, globalIndex)}
              />
            );
          })}
        </View>
      )}

      {/* Summary for many files */}
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

      {/* File Viewer */}
      {selectedFile && (
        <FileViewerNative
          visible={showViewer}
          file={selectedFile}
          files={allRNFiles}
          initialIndex={selectedFileIndex}
          onClose={() => {
            setShowViewer(false);
            setSelectedFileIndex(-1);
          }}
          onDownload={handleDownload}
          onShare={handleShare}
          canDownload={true}
          canShare={true}
        />
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
    borderColor: '#E5E7EB',
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
});