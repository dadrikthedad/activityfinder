// features/cryptoAttachments/comp/AttachmentViewer.tsx - Updated to receive openFile as prop
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { 
  createAttachmentPressHandler,
  openSingleFile,
  convertAttachmentToRNFile
} from '../hooks/useEncryptedAttachmentOpener';



// Component Props
interface AttachmentGridProps {
  attachments?: AttachmentDto[];
  files?: RNFile[];
  isMapped?: boolean;
  // Receive openFile function from parent instead of creating own hook
  openFile: (index: number) => Promise<void>;
  // Receive other functions from parent
  isDecrypting?: (fileUrl: string) => boolean;
  canViewInline?: (file: RNFile) => boolean;
  // Optional override for attachment press
  onAttachmentPress?: (index: number) => void;
  showFileInfo?: boolean;
  layout?: 'grid' | 'list';
  maxFiles?: number;
  viewerOptions?: {
    showDownload?: boolean;
    showShare?: boolean;
  };
  messageSentAt?: string;
  style?: any;
}

/**
 * AttachmentViewer Component
 * Pure UI component that receives attachment logic from parent
 */
export const AttachmentGrid: React.FC<AttachmentGridProps> = ({
  attachments,
  files,
  isMapped = false,
  openFile,
  isDecrypting,
  canViewInline,
  onAttachmentPress,
  showFileInfo = true,
  layout = 'grid',
  maxFiles,
  viewerOptions,
  messageSentAt,
  style,
}) => {
  // Convert data to RNFile array (same logic as in the hook)
  const normalizedFiles: RNFile[] = React.useMemo(() => {
    if (files) {
      return files;
    }
    if (attachments) {
      // We need optimistic mapping - get from parent or use empty object
      const optimisticToServerAttachmentMap = {}; // This should be passed from parent if needed
      return attachments.map(att => convertAttachmentToRNFile(att, optimisticToServerAttachmentMap));
    }
    return [];
  }, [attachments, files]);

  // Check if any file is currently being decrypted
  const isAnyFileDecrypting = attachments?.some(attachment => 
    attachment.needsDecryption && isDecrypting?.(attachment.fileUrl)
  ) || false;

  // Handle attachment press
  const handleAttachmentPress = (index: number) => {
    if (onAttachmentPress) {
      onAttachmentPress(index);
    } else {
      openFile(index);
    }
  };

  // Default canViewInline function if not provided
  const defaultCanViewInline = React.useCallback((file: RNFile): boolean => {
    const INLINE_VIEWABLE_TYPES = [
      'text/plain',
      'application/json',
      'text/markdown',
      'text/html',
      'text/css',
      'text/javascript',
      'text/typescript',
      'application/xml',
      'text/xml',
      'text/csv'
    ];

    const INLINE_VIEWABLE_EXTENSIONS = [
      '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', 
      '.css', '.html', '.xml', '.csv', '.env', '.yaml', '.yml',
      '.log', '.sql', '.py', '.java', '.cpp', '.c', '.php',
      '.gitignore', '.dockerfile'
    ];

    const decodedFileName = decodeURIComponent(file.name);
    const fileInfo = getFileTypeInfo(file.type, decodedFileName);
    const extension = '.' + decodedFileName.toLowerCase().split('.').pop();
    
    return (
      INLINE_VIEWABLE_TYPES.includes(file.type) ||
      INLINE_VIEWABLE_EXTENSIONS.includes(extension) ||
      fileInfo.category === 'code' ||
      fileInfo.category === 'config' ||
      fileInfo.category === 'data' ||
      (fileInfo.category === 'document' && file.type === 'text/plain')
    );
  }, []);

  const canViewInlineFunc = canViewInline || defaultCanViewInline;

  // Filter files if maxFiles is specified
  const displayFiles = maxFiles ? normalizedFiles.slice(0, maxFiles) : normalizedFiles;
  const remainingCount = maxFiles && normalizedFiles.length > maxFiles 
    ? normalizedFiles.length - maxFiles 
    : 0;

  if (normalizedFiles.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Files Grid/List */}
      <View style={layout === 'grid' ? styles.grid : styles.list}>
        {displayFiles.map((file, index) => (
          <AttachmentItem
            key={`${file.uri}-${index}`}
            file={file}
            attachment={attachments?.[index]}
            index={index}
            onPress={() => handleAttachmentPress(index)}
            showFileInfo={showFileInfo}
            canViewInline={canViewInlineFunc(file)}
            isDecrypting={attachments?.[index] ? (isDecrypting?.(attachments[index].fileUrl) || false) : false}
            layout={layout}
          />
        ))}
      </View>

      {/* Show remaining files count */}
      {remainingCount > 0 && (
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => openFile(maxFiles || 0)}
        >
          <Text style={styles.moreText}>
            +{remainingCount} more file{remainingCount > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Loading indicator */}
      {isAnyFileDecrypting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Preparing file...</Text>
        </View>
      )}
    </View>
  );
};

// Individual Attachment Item Component
interface AttachmentItemProps {
  file: RNFile;
  attachment?: AttachmentDto;
  index: number;
  onPress: () => void;
  showFileInfo: boolean;
  canViewInline: boolean;
  isDecrypting: boolean;
  layout: 'grid' | 'list';
}

const AttachmentItem: React.FC<AttachmentItemProps> = ({
  file,
  attachment,
  index,
  onPress,
  showFileInfo,
  canViewInline,
  isDecrypting,
  layout,
}) => {
  const isUploading = attachment?.isOptimistic && !attachment.uploadError;
  const hasUploadError = attachment?.uploadError;

  return (
    <TouchableOpacity
      style={[
        styles.attachmentItem,
        layout === 'grid' ? styles.gridItem : styles.listItem,
        hasUploadError && styles.errorItem,
        isDecrypting && styles.processingItem
      ]}
      onPress={onPress}
      disabled={isDecrypting}
    >
      {/* File Icon/Preview */}
      <View style={styles.iconContainer}>
        {hasUploadError ? (
          <Text style={styles.errorIcon}>⚠️</Text>
        ) : isUploading ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={styles.fileIcon}>
            {getFileIcon(file.type)}
          </Text>
        )}
      </View>

      {/* File Info */}
      {showFileInfo && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
          
          {file.size && (
            <Text style={styles.fileSize}>
              {formatFileSize(file.size)}
            </Text>
          )}
          
          {canViewInline && (
            <Text style={styles.previewable}>Previewable</Text>
          )}
          
          {hasUploadError && (
            <Text style={styles.errorText}>Upload failed</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Helper Functions
const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('text')) return '📝';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  return '📎';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Styles
const styles = StyleSheet.create({
  container: {
    // Your container styles
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  list: {
    flexDirection: 'column',
    gap: 4,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  gridItem: {
    flex: 1,
    minWidth: 120,
    maxWidth: '48%',
  },
  listItem: {
    width: '100%',
  },
  errorItem: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 1,
  },
  processingItem: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  fileIcon: {
    fontSize: 20,
  },
  errorIcon: {
    fontSize: 16,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  previewable: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 2,
  },
  errorText: {
    fontSize: 10,
    color: '#f44336',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  moreText: {
    fontSize: 12,
    color: '#666',
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
  },
});

// Re-export utilities for backward compatibility
export { 
  createAttachmentPressHandler, 
  openSingleFile, 
  convertAttachmentToRNFile 
};

// Default export
export default AttachmentGrid;