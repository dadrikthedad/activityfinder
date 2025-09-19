// components/attachments/AttachmentViewer.tsx - Unified file viewer utilities
import React from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { useChatStore } from '@/store/useChatStore';
import { RootStackNavigationProp } from '@/types/navigation';
import { useLazyFileDecryption } from '@/features/cryptoAttachments/hooks/useLazyFileDecryption';

// Utility function to convert AttachmentDto to RNFile
const convertAttachmentToRNFile = (
  attachment: AttachmentDto, 
  optimisticToServerAttachmentMap: Record<string, string>
): RNFile => {
  let finalUri: string;
  
  // Prioritize localUri for optimistic attachments
  if (attachment.isOptimistic && attachment.localUri) {
    finalUri = attachment.localUri;
  } else if (attachment.optimisticId && optimisticToServerAttachmentMap[attachment.optimisticId]) {
    finalUri = optimisticToServerAttachmentMap[attachment.optimisticId];
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
  viewerOptions = {},
  messageSentAt,
}: {
  attachments?: AttachmentDto[];
  files?: RNFile[];
  isMapped?: boolean;
  viewerOptions?: {
    showDownload?: boolean;
    showShare?: boolean;
  };
  messageSentAt?: string;
}) => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const optimisticToServerAttachmentMap = useChatStore(state => state.optimisticToServerAttachmentMap);
  const { decryptFile, isLoading: isDecrypting, getError } = useLazyFileDecryption();

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

  // Function to check if file can be viewed inline
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
  console.log(`🎬 openFile called with index: ${index}, total files: ${normalizedFiles.length}`);
  
  if (index < 0 || index >= normalizedFiles.length) {
    console.error('Invalid file index:', index);
    return;
  }

  // Check upload status
  const uploadError = attachments?.[index]?.uploadError;
  if (uploadError) {
    Alert.alert(
      'Upload Failed', 
      'This file failed to upload. Please try sending it again.',
      [{ text: 'OK' }]
    );
    return;
  }

  const attachment = attachments?.[index];
  let fileToOpen = normalizedFiles[index];
  let allFilesToOpen = [...normalizedFiles];

  console.log(`🎬 Initial fileToOpen:`, {
    name: fileToOpen.name,
    type: fileToOpen.type,
    uri: fileToOpen.uri,
    needsDecryption: attachment?.needsDecryption
  });

  // Handle decryption if needed
  if (attachment?.needsDecryption) {
    console.log('🔐📱 File needs decryption, starting lazy decryption for:', attachment.fileName);
    
    try {
      const decryptedUrl = await decryptFile(attachment);
      
      if (decryptedUrl) {
        console.log(`🔐📱 Decryption successful! Original: ${fileToOpen.uri}`);
        console.log(`🔐📱 Decrypted URL: ${decryptedUrl}`);
        
        // Update the specific file with decrypted URL
        fileToOpen = {
          ...fileToOpen,
          uri: decryptedUrl
        };
        
        // Update the files array for gallery view with the decrypted URL
        allFilesToOpen = normalizedFiles.map((file, idx) => {
          if (idx === index) {
            console.log(`🔐📱 Updating file ${idx} with decrypted URL: ${decryptedUrl}`);
            return fileToOpen;
          }
          return file;
        });
        
        console.log('🔐📱 ✅ File decrypted successfully, opening:', decryptedUrl);
      } else {
        const errorMsg = getError(attachment.fileUrl) || 'Unknown decryption error';
        console.error(`🔐📱 ❌ Decryption failed: ${errorMsg}`);
        Alert.alert(
          'Decryption Failed',
          `Could not decrypt this file: ${errorMsg}`,
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
      console.error('🔐📱 ❌ Decryption error:', error);
      Alert.alert(
        'Decryption Failed',
        'Could not decrypt this file. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }
  }

  const fileInfo = getFileTypeInfo(fileToOpen.type, fileToOpen.name);
  
  console.log(`🎬 About to navigate to MediaViewer:`, {
    fileName: fileToOpen.name,
    fileType: fileToOpen.type,
    category: fileInfo.category,
    finalUri: fileToOpen.uri,
    allFilesCount: allFilesToOpen.length,
    allFileUris: allFilesToOpen.map(f => f.uri)
  });
  
  // Decision logic for opening files
  
  // 1. Media files (images/videos) → MediaViewer for gallery
  if (fileInfo.category === 'image' || fileInfo.category === 'video') {
    console.log('🎬 Opening MediaViewer for media file:', {
      name: fileToOpen.name,
      type: fileToOpen.type,
      category: fileInfo.category,
      uri: fileToOpen.uri
    });
    
    navigation.navigate('MediaViewer', {
      files: allFilesToOpen,
      initialIndex: index,
      viewerOptions,
    });
    return;
  }
  
  // 2. Documents that CAN be viewed inline → MediaViewer (will use DocumentViewer inside)
  if (canViewInline(fileToOpen)) {
    console.log('📄 Opening DocumentViewer for previewable file:', {
      name: fileToOpen.name,
      type: fileToOpen.type,
      category: fileInfo.category,
      canPreview: true,
      uri: fileToOpen.uri
    });
    
    navigation.navigate('MediaViewer', {
      files: allFilesToOpen,
      initialIndex: index,
    });
    return;
  }
  
  // 3. Documents that CANNOT be viewed inline → Native app directly
  console.log('📄 Opening file with native app (not previewable):', {
    name: fileToOpen.name,
    type: fileToOpen.type,
    category: fileInfo.category,
    canPreview: false,
    uri: fileToOpen.uri
  });
  
  try {
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
    
    const { openFileWithNativeApp } = await import('@/components/files/FileHandlerNative');
    await openFileWithNativeApp(fileToOpen.uri, fileToOpen.name, confirmModal);
  } catch (error) {
    console.error('Failed to open file with native app:', error);
    
    Alert.alert(
      'Cannot Open File',
      'This file type cannot be opened directly. Would you like to try viewing it in the app?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Try Viewing', 
          onPress: () => {
            navigation.navigate('MediaViewer', {
              files: allFilesToOpen,
              initialIndex: index,
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
    isDecrypting,
  };
};


// Export utilities for external use
export { convertAttachmentToRNFile };

// Default export the hook for convenience
export default useAttachmentViewer;