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
import { AttachmentCacheService } from '@/features/crypto/cache/AttachmentCacheService';
import { RootStackNavigationProp } from '@/types/navigation';
import * as MediaLibrary from 'expo-media-library';


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
  const { decryptFile, isLoading: isDecrypting, getError, getDecryptedUrl } = useLazyFileDecryption();
  const cacheService = React.useRef(AttachmentCacheService.getInstance());

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


const searchForLocalFile = async (attachment: AttachmentDto, messageSentAt?: string): Promise<string | null> => {
  console.log(`🔍 Searching for file: ${attachment.fileName}, size: ${attachment.fileSize}`);
  
  // STEG 1: Eksisterende localUri-sjekk først (raskest)
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

  // STEG 2: MediaLibrary søk for media filer (mest effektivt)
  const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
  const isMediaFile = fileInfo.category === 'image' || fileInfo.category === 'video';
  
  if (isMediaFile) {
    console.log('🎥 Searching MediaLibrary for media file...');
    const mediaResult = await searchInMediaLibrary(attachment, messageSentAt);
    if (mediaResult) {
      return mediaResult;
    }
  }

  // STEG 3: Begrenset filsystem-søk kun for non-media eller fallback
  console.log('📁 Fallback to limited filesystem search...');
  return await searchInCriticalPaths(attachment);
};

const searchInMediaLibrary = async (attachment: AttachmentDto, messageSentAt?: string): Promise<string | null> => {
  try {
    // Be om tillatelser
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('MediaLibrary permission denied, skipping');
      return null;
    }

    const fileInfo = getFileTypeInfo(attachment.fileType, attachment.fileName);
    const mediaType = fileInfo.category === 'video' 
      ? MediaLibrary.MediaType.video 
      : MediaLibrary.MediaType.photo;

    console.log(`🎥 Searching for ${mediaType} files...`);

    // Hent nylige media filer (begrenset antall for ytelse)
    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: mediaType,
      first: 100,
      sortBy: 'creationTime',
    });

    if (assets.assets.length === 0) {
      console.log('No media files found');
      return null;
    }

    console.log(`🎥 Found ${assets.assets.length} ${mediaType} files to search`);

    // FORBEDRET: Hjelpefunksjon for å hente asset info med fallback
    const getAssetInfoSafely = async (assetId: string, assetUri: string) => {
        try {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
            return assetInfo.localUri || assetInfo.uri;
        } catch (error) {
            // Konverter til string for sikker sammenligning
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            if (errorMessage.includes('ACCESS_MEDIA_LOCATION') || 
                errorMessage.includes('ExifInterface')) {
            console.log('EXIF access denied, using basic asset URI');
            return assetUri;
            }
            console.warn('Asset info access failed:', error);
            return null;
        }
        };

    // Søkestrategi 1: Eksakt filnavn match
    for (const asset of assets.assets) {
      if (asset.filename === attachment.fileName) {
        console.log(`🎯 Exact filename match: ${asset.filename}`);
        const uri = await getAssetInfoSafely(asset.id, asset.uri);
        if (uri) return uri;
      }
    }

    // Søkestrategi 2: Tid matching
    if (messageSentAt) {
      const sentTime = new Date(messageSentAt).getTime();
      const timeWindow = 30 * 60 * 1000;

      for (const asset of assets.assets) {
        const timeDiff = Math.abs(sentTime - asset.creationTime);
        
        if (timeDiff <= timeWindow) {
          console.log(`🎯 Time match: ${asset.filename} (${Math.round(timeDiff/1000)}s time diff)`);
          const uri = await getAssetInfoSafely(asset.id, asset.uri);
          if (uri) return uri;
        }
      }
    }

    // Søkestrategi 3: Dimensjons matching
    for (const asset of assets.assets) {
      if (fileInfo.category === 'video' && asset.width && asset.height) {
        console.log(`🎯 Found video by scanning: ${asset.filename} (${asset.width}x${asset.height})`);
        const uri = await getAssetInfoSafely(asset.id, asset.uri);
        if (uri) return uri;
      }
      if (fileInfo.category === 'image') {
        console.log(`🎯 Found image by scanning: ${asset.filename}`);
        const uri = await getAssetInfoSafely(asset.id, asset.uri);
        if (uri) return uri;
      }
    }

    console.log('No matching media file found in MediaLibrary');
    return null;

  } catch (error) {
    console.warn('MediaLibrary search failed:', error);
    return null;
  }
};

const searchInCriticalPaths = async (attachment: AttachmentDto): Promise<string | null> => {
  // Kun søk i mest sannsynlige steder for rask fallback
  const criticalPaths = [
    `${FileSystem.cacheDirectory}ImagePicker/`,
    `${FileSystem.documentDirectory}Downloads/`,
    `${FileSystem.documentDirectory}`,
  ];

  for (const basePath of criticalPaths) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(basePath);
      if (!dirInfo.exists) continue;

      // Direkte filnavn-sjekk (ingen directory traversal)
      const fullPath = `${basePath}${attachment.fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      
      if (fileInfo.exists && !fileInfo.isDirectory) {
        console.log(`📁 Found in critical path: ${fullPath}`);
        return fullPath;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
};

// Oppdatert resolveFileUri
const resolveFileUri = async (attachment: AttachmentDto, originalFile: RNFile, messageSentAt?: string): Promise<RNFile> => {
  if (!attachment?.needsDecryption) {
    return originalFile;
  }

  console.log(`🔍 Resolving URI for: ${attachment.fileName}`);
  
  // STEG 1: Utvidet søk etter lokale filer
  console.log('🔍 Starting local file search...');
  try {
    const localPath = await searchForLocalFile(attachment, messageSentAt);
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

    // Handle file resolution with prioritized cache strategy
    if (attachment?.needsDecryption) {
      try {
        // Resolve the primary file
        fileToOpen = await resolveFileUri(attachment, fileToOpen, messageSentAt);
        
        // Update the files array with resolved URI
        allFilesToOpen = normalizedFiles.map((file, idx) => {
          if (idx === index) {
            return fileToOpen;
          }
          return file;
        });
        
        console.log('🔐 File resolved successfully:', fileToOpen.uri);
      } catch (error) {
        console.error('🔐 File resolution failed:', error);
        Alert.alert(
          'Cannot Open File',
          error instanceof Error ? error.message : 'Could not open this file. Please try again.',
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
            return await resolveFileUri(attachment, file, messageSentAt);
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