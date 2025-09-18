// features/files/hooks/useAttachmentViewer.ts - Enhanced med cache priority
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { convertAttachmentToRNFile } from '@/components/files/AttachmentViewer';
import { useChatStore } from '@/store/useChatStore';
import { useLazyFileDecryption } from '@/features/cryptoAttachments/hooks/useLazyFileDecryption';
import { AttachmentCacheService } from '@/features/crypto/storage/AttachmentCacheService';
import { RootStackNavigationProp } from '@/types/navigation';
import * as MediaLibrary from 'expo-media-library';
import { useDecryptionStore } from '@/features/crypto/store/useDecryptionStore';


// Hook for handling file viewing logic
export const useAttachmentViewer = ({
  attachments,
  files,
  isMapped = false,
  viewerOptions = {},
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

  const cacheService = React.useRef(AttachmentCacheService.getInstance());

  const { decryptFile, getDecryptedUrl, isLoading: isDecrypting, getError } = useLazyFileDecryption();
  const { getProgress, getStatus } = useDecryptionStore();

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


const searchForLocalFile = async (attachment: AttachmentDto): Promise<string | null> => {
  console.log(`🔍 Searching for file by filename: ${attachment.fileName}`);
  
  // STEG 1: Sjekk localUri først (optimistiske meldinger)
  if (attachment.localUri) {
    console.log(`📱 Checking localUri: ${attachment.localUri}`);
    try {
      const fileExists = await FileSystem.getInfoAsync(attachment.localUri);
      if (fileExists.exists) {
        console.log('📱 Found via localUri:', attachment.fileName);
        return attachment.localUri;
      }
    } catch (error) {
      console.warn('LocalUri check failed:', error);
    }
  }

  // STEG 2: Søk etter eksakt filnavn i app-cache og downloads
  console.log('📁 Searching by filename in app directories...');
  return await searchInCriticalPaths(attachment);
};

const searchInCriticalPaths = async (attachment: AttachmentDto): Promise<string | null> => {
  const searchPaths = [
    // App-cache mapper
    `${FileSystem.cacheDirectory}ImagePicker/`,
    `${FileSystem.cacheDirectory}decrypted_attachments/`,
    
    // Downloads og lagrede filer
    `${FileSystem.documentDirectory}Downloads/`,
    `${FileSystem.documentDirectory}`,
    `${FileSystem.cacheDirectory}`,
    
    // Andre mulige steder
    `${FileSystem.documentDirectory}Pictures/`,
    `${FileSystem.documentDirectory}Media/`,
  ];

  for (const basePath of searchPaths) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(basePath);
      if (!dirInfo.exists) continue;

      const fullPath = `${basePath}${attachment.fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      
      if (fileInfo.exists && !fileInfo.isDirectory) {
        console.log(`📁 Found in path: ${fullPath}`);
        return fullPath;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
};

// Oppdatert resolveFileUri
const resolveFileUri = async (attachment: AttachmentDto, originalFile: RNFile): Promise<RNFile> => {
  if (!attachment?.needsDecryption) {
    return originalFile;
  }

  console.log(`🔍 Resolving URI for: ${attachment.fileName}`);
  
  // STEG 1: Søk etter lokale filer (filnavn-basert)
  console.log('🔍 Starting local file search...');
  try {
    const localPath = await searchForLocalFile(attachment);
    console.log('🔍 Local search result:', localPath);
    if (localPath) {
      console.log('📱 Using local file:', attachment.fileName);
      return {
        ...originalFile,
        uri: localPath
      };
    }
  } catch (error) {
    console.error('🔍 Local search failed:', error);
  }

  // STEG 2: Sjekk AttachmentCacheService  
  console.log(`📦 Checking AttachmentCacheService for: ${attachment.fileUrl}`);
  try {
      const cachedPath = await cacheService.current.getCachedAttachment(attachment.fileUrl);
      console.log(`📦 Cache result:`, cachedPath);
      if (cachedPath) {
      console.log('📦 Using AttachmentCacheService:', attachment.fileName);
      return {
          ...originalFile,
          uri: cachedPath
      };
      }
  } catch (error) {
      console.warn('Failed to check attachment cache:', error);
  }

  // STEG 3: Sjekk memory state fra useLazyFileDecryption
  const existingDecryptedUrl = getDecryptedUrl(attachment.fileUrl);
  if (existingDecryptedUrl) {
    console.log('🧠 Using memory state:', attachment.fileName);
    return {
      ...originalFile,
      uri: existingDecryptedUrl
    };
  }

  // STEG 4: Dekrypter hvis nødvendig
  console.log('🔐 Decrypting file:', attachment.fileName);
  const decryptedUrl = await decryptFile(attachment);
  
  if (decryptedUrl) {
    console.log('✅ Decryption successful:', attachment.fileName);
    return {
      ...originalFile,
      uri: decryptedUrl
    };
  } else {
    const errorMsg = getError(attachment.fileUrl) || 'Unknown decryption error';
    throw new Error(`Decryption failed: ${errorMsg}`);
  }
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

  // Handle file resolution with prioritized cache strategy and hybrid UX
  if (attachment?.needsDecryption) {
    let navigationTimeout: NodeJS.Timeout | null = null;
    let hasNavigated = false;

    try {
      // Start decryption immediately
      const decryptionPromise = resolveFileUri(attachment, fileToOpen);
      
      // Set up navigation timeout for long operations (2 seconds)
      navigationTimeout = setTimeout(() => {
        console.log('🔐 Decryption taking longer than expected, navigating to MediaViewer...');
        hasNavigated = true;
        
        const fileInfo = getFileTypeInfo(fileToOpen.type, fileToOpen.name);
        
        navigation.navigate('MediaViewer', {
          files: allFilesToOpen,
          initialIndex: index,
          viewerOptions: {
            ...viewerOptions,
            isDecrypting: true,
            decryptingFileUrl: attachment.fileUrl,
            decryptingFileName: attachment.fileName
          },
        });
      }, 2000);

      // Wait for decryption to complete
      fileToOpen = await decryptionPromise;
      
      // Clear timeout since decryption completed
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = null;
      }
      
      // Update the files array with resolved URI
      allFilesToOpen = normalizedFiles.map((file, idx) => {
        if (idx === index) {
          return fileToOpen;
        }
        return file;
      });
      
      console.log('🔐 File resolved successfully:', fileToOpen.uri);
      
      // If we already navigated due to timeout, don't navigate again
      // The MediaViewer will handle the resolved file through state updates
      if (hasNavigated) {
        console.log('🔐 Already navigated to MediaViewer, decryption completed');
        return;
      }
      
    } catch (error) {
      // Clear timeout on error
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = null;
      }
      
      console.error('🔐 File resolution failed:', error);
      
      // If we haven't navigated yet, show error alert
      if (!hasNavigated) {
        Alert.alert(
          'Cannot Open File',
          error instanceof Error ? error.message : 'Could not open this file. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      } else {
        // If we've navigated, the MediaViewer will handle the error
        return;
      }
    }
  }

  const fileInfo = getFileTypeInfo(fileToOpen.type, fileToOpen.name);
  
  console.log(`🎬 About to navigate to MediaViewer:`, {
    fileName: fileToOpen.name,
    fileType: fileToOpen.type,
    category: fileInfo.category,
    finalUri: fileToOpen.uri,
    allFilesCount: allFilesToOpen.length
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

  // Utility method for batch file resolution (for gallery view)
  const resolveAllFiles = async (): Promise<RNFile[]> => {
    return Promise.all(
      normalizedFiles.map(async (file, index) => {
        const attachment = attachments?.[index];
        if (attachment?.needsDecryption) {
          try {
            return await resolveFileUri(attachment, file);
          } catch (error) {
            console.warn(`Failed to resolve file ${index}:`, error);
            return file; // Return original if resolution fails
          }
        }
        return file;
      })
    );
  };

  const openFiles = (startIndex = 0) => {
    openFile(startIndex);
  };

  return {
    normalizedFiles,
    openFile,
    openFiles,
    resolveAllFiles, // NEW: For pre-resolving files in gallery
    isDecrypting,
  };
};