// components/attachments/AttachmentViewer.tsx - Unified file viewer utilities
import React from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { useChatStore } from '@/store/useChatStore';
import { RootStackNavigationProp } from '@/types/navigation';

// Utility function to convert AttachmentDto to RNFile
const convertAttachmentToRNFile = (
  attachment: AttachmentDto, 
  optimisticToServerAttachmentMap: Record<string, string>
): RNFile => {
  let finalUri: string;
  
  if (attachment.isOptimistic && attachment.optimisticId) {
    const mappedServerUrl = optimisticToServerAttachmentMap[attachment.optimisticId];
    
    if (mappedServerUrl) {
      finalUri = mappedServerUrl;
      console.log(`📎 Using mapped server URL for ${attachment.optimisticId}: ${mappedServerUrl}`);
    } else {
      finalUri = attachment.localUri || attachment.fileUrl;
      console.log(`📱 Using local URI for unmapped attachment: ${finalUri}`);
    }
  } else {
    finalUri = attachment.fileUrl;
  }
  
  return {
    uri: finalUri,
    type: attachment.fileType,
    name: decodeURIComponent(attachment.fileName || 'unknown'),
    size: attachment.fileSize,
  };
};

// Hook for handling file viewing logic
export const useAttachmentViewer = ({
  attachments,
  files,
  isMapped = false,
  viewerOptions = {}, // NEW: Add viewer options
}: {
  attachments?: AttachmentDto[];
  files?: RNFile[];
  isMapped?: boolean;
  viewerOptions?: {
    showDownload?: boolean;
    showShare?: boolean;
  };
}) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const optimisticToServerAttachmentMap = useChatStore(state => state.optimisticToServerAttachmentMap);

  // Convert data to RNFile array
  const normalizedFiles: RNFile[] = React.useMemo(() => {
    if (files) {
      return files;
    }
    if (attachments) {
      return attachments.map(att => convertAttachmentToRNFile(att, optimisticToServerAttachmentMap));
    }
    return [];
  }, [attachments, files, optimisticToServerAttachmentMap]);

  // 🆕 NEW: Function to check if file can be viewed inline (same logic as DocumentViewer)
  const canViewInline = (file: RNFile): boolean => {
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
  };

  const openFile = async (index: number) => {
    if (index < 0 || index >= normalizedFiles.length) {
      console.error('Invalid file index:', index);
      return;
    }

    // Check if it's uploading (for optimistic attachments)
    const uploadError = attachments?.[index]?.uploadError;
    
    if (uploadError) {
      if (uploadError) {
        Alert.alert(
          'Upload Failed', 
          'This file failed to upload. Please try sending it again.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    const file = normalizedFiles[index];
    const fileInfo = getFileTypeInfo(file.type, file.name);
    
    // 🎯 DECISION LOGIC:
    
    // 1. Media files (images/videos) → MediaViewer for gallery
    if (fileInfo.category === 'image' || fileInfo.category === 'video') {
      console.log('🎬 Opening MediaViewer for media file:', {
        name: file.name,
        type: file.type,
        category: fileInfo.category
      });
      
      navigation.navigate('MediaViewer', {
        files: normalizedFiles,
        initialIndex: index,
        conversationId: undefined,
        viewerOptions,
      });
      return;
    }
    
    // 2. Documents that CAN be viewed inline → MediaViewer (will use DocumentViewer inside)
    if (canViewInline(file)) {
      console.log('📄 Opening DocumentViewer for previewable file:', {
        name: file.name,
        type: file.type,
        category: fileInfo.category,
        canPreview: true
      });
      
      navigation.navigate('MediaViewer', {
        files: normalizedFiles,
        initialIndex: index,
        conversationId: undefined
      });
      return;
    }
    
    // 3. Documents that CANNOT be viewed inline → Native app directly
    console.log('📄 Opening file with native app (not previewable):', {
      name: file.name,
      type: file.type,
      category: fileInfo.category,
      canPreview: false
    });
    
    try {
      // Create a simple confirmation modal for native app opening
      const confirmModal = {
        confirm: async (options: { title?: string; message: string }) => {
          return new Promise<boolean>((resolve) => {
            Alert.alert(
              options.title || 'Open File',
              options.message,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Open', onPress: () => resolve(true) }
              ]
            );
          });
        }
      };
      
      // Import the function dynamically to avoid circular imports
      const { openFileWithNativeApp } = await import('@/components/files/FileHandlerNative');
      
      await openFileWithNativeApp(file.uri, file.name, confirmModal);
    } catch (error) {
      console.error('Failed to open file with native app:', error);
      
      // Fallback to MediaViewer if native opening fails
      Alert.alert(
        'Cannot Open File',
        'This file type cannot be opened directly. Would you like to try viewing it in the app?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Try Viewing', 
            onPress: () => {
              navigation.navigate('MediaViewer', {
                files: normalizedFiles,
                initialIndex: index,
                conversationId: undefined
              });
            }
          }
        ]
      );
    }
  };

  const openFiles = (startIndex = 0) => {
    openFile(startIndex);
  };

  return {
    normalizedFiles,
    openFile,
    openFiles,
  };
};

// Utility function for handling attachment press in message components
export const createAttachmentPressHandler = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const optimisticToServerAttachmentMap = useChatStore(state => state.optimisticToServerAttachmentMap);
  
  return (
    attachment: AttachmentDto,
    index: number,
    allAttachments: AttachmentDto[],
    options: {
      isLocked?: boolean;
      blurredAttachments?: Set<string>;
      toggleBlur?: (fileUrl: string) => void;
      isMapped?: boolean;
    } = {}
  ) => {
    const { isLocked, blurredAttachments, toggleBlur, isMapped } = options;
    
    // Check upload status
    const showUploadStatus = Boolean(
      attachment.isOptimistic && 
      !isMapped && 
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
    const isCurrentlyBlurred = isLocked && blurredAttachments?.has(attachment.fileUrl);
    
    if (isCurrentlyBlurred && toggleBlur) {
      toggleBlur(attachment.fileUrl);
      return;
    }

    // Convert attachments to files
    const normalizedFiles = allAttachments.map(att => 
      convertAttachmentToRNFile(att, optimisticToServerAttachmentMap)
    );
    
    console.log('🎬 Opening MediaViewer from message attachment:', {
      fileName: attachment.fileName,
      index,
      totalFiles: normalizedFiles.length
    });

    // All files go to MediaViewer - it handles all file types
    navigation.navigate('MediaViewer', {
      files: normalizedFiles,
      initialIndex: index,
      conversationId: undefined
    });
  };
};

// Utility function to open a single file directly
export const openSingleFile = (
  file: RNFile | AttachmentDto, 
  navigation: RootStackNavigationProp,
  optimisticToServerAttachmentMap?: Record<string, string>
) => {
  let normalizedFile: RNFile;
  
  if ('fileUrl' in file) {
    // It's an AttachmentDto
    normalizedFile = convertAttachmentToRNFile(file, optimisticToServerAttachmentMap || {});
  } else {
    // It's already an RNFile
    normalizedFile = file;
  }
  
  console.log('🎬 Opening single file in MediaViewer:', {
    name: normalizedFile.name,
    type: normalizedFile.type
  });
  
  navigation.navigate('MediaViewer', {
    files: [normalizedFile],
    initialIndex: 0,
    conversationId: undefined
  });
};

// Export utilities for external use
export { convertAttachmentToRNFile };

// Default export the hook for convenience
export default useAttachmentViewer;