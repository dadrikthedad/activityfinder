// features/cryptoAttachments/hooks/useEncryptedAttachmentOpener.ts - Final version
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { useChatStore } from '@/store/useChatStore';
import { useLazyFileDecryption } from '@/features/cryptoAttachments/hooks/useLazyFileDecryption';
import { useLazyFileBackgroundDecryption } from '../../BackgroundDecrypt/hooks/useLazyFileBackgroundDecryption';
import { SmartDecryptionService } from '../../services/SmartDecryptionService';
import { AttachmentCacheService } from '@/features/crypto/storage/AttachmentCacheService';
import { RootStackNavigationProp } from '@/types/navigation';
import { useDecryptionStore } from '@/features/crypto/store/useDecryptionStore';
import { showNotificationToastNative, LocalToastType } from '@/components/toast/NotificationToastNative';
import { BackgroundAttachmentDecryptionService } from '../../BackgroundDecrypt/BackgrundAttachmentDecryptionService';
import { useCurrentUser } from '@/store/useUserCacheStore';


// Import separated services
import { convertAttachmentToRNFile, canViewInline } from '../../utils/AttachmentOpener';

import { FileSystemService } from '../services/FileSystemService';

import { unifiedCacheManager } from '@/features/crypto/storage/UnifiedCacheManager';
import { useUnifiedCache } from '@/features/crypto/storage/hooks/useUnifiedCache';
// Re-export utilities for backward compatibility
export { 
  convertAttachmentToRNFile, 
  canViewInline,
  openSingleFile,
  createAttachmentPressHandler 
} from '../../utils/AttachmentOpener';

import { generateCacheKey } from '@/features/crypto/storage/utils/cacheKeyUtils';

/**
 * Enhanced attachment opener with SmartDecryptionService and unified cache management
 */
export const useEncryptedAttachmentOpener = ({
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

  const currentUser = useCurrentUser();

  // Services
  const smartDecryptionService = React.useRef(SmartDecryptionService.getInstance());
  const cacheService = React.useRef(AttachmentCacheService.getInstance());
  const fileSystemService = React.useRef(FileSystemService.getInstance());

  const showErrorToast = React.useCallback((message: string) => {
    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: "Error",
      customBody: message,
      position: 'top'
    });
  }, []);
  
  // Unified cache management
  const {
    getStorageStats,
    clearCache,
    getCachedThumbnail,
    preloadConversationKeys,
    getFile
  } = useUnifiedCache();
  
  // Decryption hooks
  const lazyDecryption = useLazyFileDecryption();
  const backgroundDecryption = useLazyFileBackgroundDecryption();
  
  const { getDecryptedUrl, clearDecryptionState } = useDecryptionStore();

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

  // Get smart decryption strategy
  const getStrategy = React.useCallback((attachment: AttachmentDto) => {
    return smartDecryptionService.current.getDecryptionStrategy(attachment);
  }, []);

  // Select the right decryption hook based on strategy
  const decryptFile = React.useCallback(async (
  attachment: AttachmentDto, 
  skipCache = false, 
  cacheOptions?: { cacheAlreadyChecked?: boolean; cacheKey?: string }
) => {
  const strategy = getStrategy(attachment);
  
  if (strategy.immediate === 'lazy') {
    console.log(`Smart decryption for ${attachment.fileName}: ${strategy.reason}`);
    console.log(`Using lazy decryption for ${attachment.fileName}`);
    
    // Pass cache options to lazy decryption
    if (cacheOptions?.cacheAlreadyChecked) {
      return await lazyDecryption.decryptFile(attachment, { skipCacheCheck: true });
    }
    return await lazyDecryption.decryptFile(attachment);
    
  } else {
    console.log(`Smart decryption for ${attachment.fileName}: ${strategy.reason}`);
    console.log(`Using background decryption for ${attachment.fileName}`);
    
    // Pass cache options to background decryption
    if (cacheOptions?.cacheAlreadyChecked) {
      return await backgroundDecryption.decryptFile(attachment, { skipCacheCheck: true });
    }
    return await backgroundDecryption.decryptFile(attachment);
  }
}, [getStrategy, lazyDecryption, backgroundDecryption]);

  // Main openFile function
  // Main openFile function - Updated for video background decryption
const openFile = React.useCallback(async (index: number) => {
  console.log(`openFile called with index: ${index}, total files: ${normalizedFiles.length}`);
  
  if (index < 0 || index >= normalizedFiles.length) {
    console.error('Invalid file index:', index);
    return;
  }

  // Check upload status
  const uploadError = attachments?.[index]?.uploadError;
  if (uploadError) {
    showErrorToast('This file failed to upload. Please try sending it again.');
    return;
  }

  const attachment = attachments?.[index];
  let fileToOpen = normalizedFiles[index];
  let allFilesToOpen = [...normalizedFiles];

  console.log(`Initial fileToOpen:`, {
    name: fileToOpen.name,
    type: fileToOpen.type,
    uri: fileToOpen.uri,
    needsDecryption: attachment?.needsDecryption
  });

  // Handle decryption with smart strategy and cache-first approach
  if (attachment?.needsDecryption) {
    const strategy = getStrategy(attachment);
    console.log(`Using smart decryption strategy: ${strategy.reason}`);
    
    // STEP 1: Check decryption store first
    const cachedUrl = getDecryptedUrl(attachment.fileUrl);
    if (cachedUrl) {
      try {
        // Verify cached file still exists
        const fileInfo = await FileSystem.getInfoAsync(cachedUrl);
        if (fileInfo.exists) {
          console.log('Using cached file from decryption store, navigating immediately');
          fileToOpen = { ...fileToOpen, uri: cachedUrl };
          allFilesToOpen = normalizedFiles.map((file, idx) =>
            idx === index ? fileToOpen : file
          );
          // Skip decryption entirely - file is cached and ready
        } else {
          console.log('Cached file no longer exists, will decrypt');
          clearDecryptionState?.(attachment.fileUrl);
        }
      } catch (error) {
        console.log('Error checking cached file, will decrypt');
        clearDecryptionState?.(attachment.fileUrl);
      }
    } else {
      // STEP 2: Check UnifiedCacheManager before starting decryption
      console.log('Not in decryption store, checking UnifiedCacheManager...');
      
      try {
              const fileKey = generateCacheKey(attachment.fileUrl);
              const unifiedCachedPath = await unifiedCacheManager.getFile(fileKey, attachment.fileType, false);
              
              if (unifiedCachedPath) {
                console.log('Found file in UnifiedCacheManager, using cached version immediately');
                fileToOpen = { ...fileToOpen, uri: unifiedCachedPath };
                allFilesToOpen = normalizedFiles.map((file, idx) => 
                  idx === index ? fileToOpen : file
                );
                // Skip decryption entirely - file is cached and ready
              } else {
                console.log('File not in any cache, starting decryption based on strategy');
                
                // Only start decryption if file is not cached anywhere
                if (strategy.immediate === 'lazy') {
                  console.log('Fast decryption detected - navigating immediately with parallel decryption');
                  
                  // Pass cache info to avoid double-checking
                  decryptFile(attachment, true, { 
                    cacheAlreadyChecked: true, 
                    cacheKey: fileKey 
                  }).catch(error => {
                    console.error('Background decryption failed:', error);
                  });
                  
                  // Navigate immediately to MediaViewer with isDecrypting flag
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
                  return;
                }
              else {
            // UPDATED: Handle videos and large files differently
            const fileInfo = getFileTypeInfo(fileToOpen.type, fileToOpen.name);
            const isVideo = fileInfo.category === 'video';
            
            if (isVideo) {
                  console.log('Video detected - starting background decryption via decryptFile to update store');
                  
                  if (!currentUser?.id) {
                    showErrorToast('No user found for video decryption');
                    return;
                  }

                  // Use decryptFile which goes through useLazyFileBackgroundDecryption and updates store
                  decryptFile(attachment, true, { 
                    cacheAlreadyChecked: true, 
                    cacheKey: fileKey 
                  }).then(result => {
                    if (result) {
                      console.log(`✅ Video decryption completed: ${attachment.fileName}`);
                      showNotificationToastNative({
                        type: LocalToastType.CustomSystemNotice,
                        customTitle: "Video Ready",
                        customBody: `"${attachment.fileName}" is now ready to view`,
                        position: 'top'
                      });
                    } else {
                      console.error(`❌ Video decryption failed: ${attachment.fileName}`);
                      showErrorToast(`Failed to process video "${attachment.fileName}"`);
                    }
                  }).catch(error => {
                    console.error('Video background decryption failed:', error);
                    showErrorToast(`Error processing video "${attachment.fileName}": ${error.message || 'Unknown error'}`);
                  });
                  
                  return; // Don't navigate - let user continue using app
                } else {
              console.log('Large file (non-video) detected - using timeout approach');
              
              let navigationTimeout: NodeJS.Timeout | null = null;
              let hasNavigated = false;

              try {
                // Start decryption
                const decryptionPromise = decryptFile(attachment, true);
                
                // Set up navigation timeout for long operations (2 seconds)
                navigationTimeout = setTimeout(() => {
                  console.log('Decryption taking longer than expected, navigating to MediaViewer...');
                  hasNavigated = true;
                  
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
                const decryptedUrl = await decryptionPromise;
                
                // Clear timeout since decryption completed
                if (navigationTimeout) {
                  clearTimeout(navigationTimeout);
                  navigationTimeout = null;
                }
                
                if (decryptedUrl) {
                  // Update the files array with resolved URI
                  fileToOpen = { ...fileToOpen, uri: decryptedUrl };
                  allFilesToOpen = normalizedFiles.map((file, idx) => {
                    if (idx === index) {
                      return fileToOpen;
                    }
                    return file;
                  });
                  
                  // If we already navigated due to timeout, don't navigate again
                  if (hasNavigated) {
                    console.log('Already navigated to MediaViewer, decryption completed');
                    return;
                  }
                } else {
                  throw new Error('Decryption returned null');
                }
                
              } catch (error) {
                // Clear timeout on error
                if (navigationTimeout) {
                  clearTimeout(navigationTimeout);
                  navigationTimeout = null;
                }
                
                console.error('File decryption failed:', error);
                
                // If we haven't navigated yet, show error toast
                if (!hasNavigated) {
                  const errorMsg = error instanceof Error ? error.message : 'Unknown decryption error';
                  showErrorToast(`Could not decrypt this file: ${errorMsg}`);
                  return;
                } else {
                  // If we've navigated, the MediaViewer will handle the error
                  return;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking UnifiedCacheManager:', error);
        console.log('Falling back to decryption due to cache check error');
        // Fall through to decryption logic below
      }
    }
  }

  const fileInfo = getFileTypeInfo(fileToOpen.type, fileToOpen.name);

  // Decision logic for opening files
  
  // 1. Media files (images/videos) → MediaViewer for gallery
  if (fileInfo.category === 'image' || fileInfo.category === 'video') {
    navigation.navigate('MediaViewer', {
      files: allFilesToOpen,
      initialIndex: index,
      viewerOptions,
    });
    return;
  }
  
  // 2. Documents that CAN be viewed inline → MediaViewer (will use DocumentViewer inside)
  if (canViewInline(fileToOpen)) {
    console.log('Opening DocumentViewer for previewable file:', {
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
  console.log('Opening file with native app (not previewable):', {
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
}, [normalizedFiles, attachments, getStrategy, getDecryptedUrl, clearDecryptionState, decryptFile, canViewInline, viewerOptions, navigation]);

  // Utility method for batch file resolution (for gallery view)
  const resolveAllFiles = React.useCallback(async (): Promise<RNFile[]> => {
    return Promise.all(
      normalizedFiles.map(async (file, index) => {
        const attachment = attachments?.[index];
        if (attachment?.needsDecryption) {
          try {
            return await fileSystemService.current.resolveFileUri(
              attachment, 
              file,
              cacheService.current,
              getDecryptedUrl,
              lazyDecryption,
              backgroundDecryption,
              smartDecryptionService.current
            );
          } catch (error) {
            console.warn(`Failed to resolve file ${index}:`, error);
            return file; // Return original if resolution fails
          }
        }
        return file;
      })
    );
  }, [normalizedFiles, attachments, getDecryptedUrl, lazyDecryption, backgroundDecryption]);

  const openFiles = React.useCallback((startIndex = 0) => {
    openFile(startIndex);
  }, [openFile]);

  // Expose smart decryption capabilities
  const isDecrypting = React.useCallback((fileUrl: string): boolean => {
    return lazyDecryption.isLoading(fileUrl) || backgroundDecryption.isLoading(fileUrl);
  }, [lazyDecryption, backgroundDecryption]);

  // Initialize cache function
  const initializeCache = React.useCallback(async () => {
    try {
      const stats = await getStorageStats();
      console.log('UnifiedCacheManager initialized:', {
        cacheFiles: stats.cache.attachments.totalFiles,
        tempFiles: stats.temp.totalFiles,
        health: stats.health.overall
      });
    } catch (error) {
      console.warn('Failed to initialize unified cache manager:', error);
    }
  }, [getStorageStats]);

  return {
    // Core functions
    normalizedFiles,
    openFile,
    openFiles,
    resolveAllFiles,
    
    // Smart decryption
    isDecrypting,
    canViewInline,
    getStrategy,
    decryptFile,
    
    // Unified cache management (delegated to useUnifiedCache)
    clearCache,
    getStats: getStorageStats,
    initializeCache,
    getCachedThumbnail,
    preloadConversationKeys,
    
    // File system service utilities
    searchForLocalFile: fileSystemService.current.searchForLocalFile.bind(fileSystemService.current),
    resolveFileUri: (attachment: AttachmentDto, originalFile: RNFile) => 
      fileSystemService.current.resolveFileUri(
        attachment, 
        originalFile,
        cacheService.current,
        getDecryptedUrl,
        lazyDecryption,
        backgroundDecryption,
        smartDecryptionService.current
      ),
  };
};