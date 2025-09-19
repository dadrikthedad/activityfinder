// features/cryptoAttachments/utils/AttachmentOpener.ts
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile, getFileTypeInfo } from '@/utils/files/FileFunctions';
import { useChatStore } from '@/store/useChatStore';
import { useLazyFileDecryption } from '@/features/cryptoAttachments/hooks/useLazyFileDecryption';
import { RootStackNavigationProp } from '@/types/navigation';

/**
 * Converts AttachmentDto to RNFile format
 */
export const convertAttachmentToRNFile = (
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

/**
 * Check if file can be viewed inline
 */
export const canViewInline = (file: RNFile): boolean => {
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

/**
 * Opens a single file directly in MediaViewer
 */
export const openSingleFile = async (
  file: RNFile | AttachmentDto, 
  navigation: RootStackNavigationProp,
  optimisticToServerAttachmentMap?: Record<string, string>,
  decryptFile?: (attachment: AttachmentDto) => Promise<string | null>
) => {
  let normalizedFile: RNFile;
  
  if ('fileUrl' in file) {
    // It's an AttachmentDto
    normalizedFile = convertAttachmentToRNFile(file, optimisticToServerAttachmentMap || {});
    
    // Handle decryption if needed
    if (file.needsDecryption && decryptFile) {
      try {
        const decryptedUrl = await decryptFile(file);
        if (decryptedUrl) {
          normalizedFile = { ...normalizedFile, uri: decryptedUrl };
        }
      } catch (error) {
        console.error('Failed to decrypt single file:', error);
      }
    }
  } else {
    // It's already an RNFile
    normalizedFile = file;
  }
  
  console.log('Opening single file in MediaViewer:', {
    name: normalizedFile.name,
    type: normalizedFile.type
  });
  
  navigation.navigate('MediaViewer', {
    files: [normalizedFile],
    initialIndex: 0,
  });
};

/**
 * Creates a press handler for attachment components in messages
 */
export const createAttachmentPressHandler = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const optimisticToServerAttachmentMap = useChatStore(state => state.optimisticToServerAttachmentMap);
  const { decryptFile } = useLazyFileDecryption();
  
  return async (
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
    let normalizedFiles = allAttachments.map(att => 
      convertAttachmentToRNFile(att, optimisticToServerAttachmentMap)
    );

    // Handle decryption if needed
    if (attachment.needsDecryption) {
      console.log('Attachment needs decryption, starting lazy decryption...');
      
      try {
        const decryptedUrl = await decryptFile(attachment);
        
        if (decryptedUrl) {
          // Update the files array with decrypted URL
          normalizedFiles = normalizedFiles.map((file, idx) => 
            idx === index ? { ...file, uri: decryptedUrl } : file
          );
          console.log('Attachment decrypted successfully');
        } else {
          Alert.alert(
            'Decryption Failed',
            'Could not decrypt this file. Please try again.',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (error) {
        console.error('Attachment decryption error:', error);
        Alert.alert(
          'Decryption Failed',
          'Could not decrypt this file. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    console.log('Opening MediaViewer from message attachment:', {
      fileName: attachment.fileName,
      index,
      totalFiles: normalizedFiles.length
    });

    navigation.navigate('MediaViewer', {
      files: normalizedFiles,
      initialIndex: index,
    });
  };
};