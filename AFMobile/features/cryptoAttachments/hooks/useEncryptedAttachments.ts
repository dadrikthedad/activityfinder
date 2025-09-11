// hooks/messages/useEncryptedAttachments.ts - Updated with encryption metadata return
import { useState } from 'react';
import { uploadEncryptedAttachmentsJSON } from '@/services/crypto/encryptedMessageService';
import { ProcessedFile } from '../types/cryptoAttachmentTypes';
import { AttachmentEncryptionService, EncryptionOptions } from '../services/AttachmentEncryptionService';
import { useEncryptMessage } from '@/features/crypto/hooks/useEncryptMessage';
import { SendEncryptedMessageResponseDTO } from '@/features/OptimsticMessage/types/MessagesToBackendTypes';

export interface UploadOptions extends EncryptionOptions {
  // Option for å sende pre-genererte thumbnails
  preGeneratedThumbnails?: Map<string, {
    buffer: ArrayBuffer;
    width: number;
    height: number;
    mimeType: string;
  }>;
}

// Extended result type to include encryption metadata
export interface UploadResultWithMetadata {
  messageId: number;
  sentAt: string;
  conversationId: number;
  attachments: {
    id: number;
    optimisticId: string;
    fileUrl: string;
    thumbnailUrl?: string;
  }[];
  // NEW: encryption metadata for preserving thumbnail decryption keys
  encryptionMetadata: Map<string, {
    // Thumbnail encryption data
    thumbnailKeyInfo?: { [userId: string]: string };
    thumbnailIV?: string;
    
    // Main file encryption data (LEGG TIL DISSE)
    fileKeyInfo?: { [userId: string]: string };
    fileIV?: string;
    version?: number;
  }>;
}

export const useEncryptedAttachments = () => {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState<string>('');
 
  const { encryptMessage } = useEncryptMessage();
 
  /**
   * Upload encrypted attachments with thumbnail support (including pre-generated)
   * Now returns encryption metadata for thumbnail decryption
   */
  const uploadEncryptedAttachments = async (
    processedFiles: ProcessedFile[],
    conversationId: number,
    messageText?: string,
    receiverId?: number,
    parentMessageId?: number,
    options: UploadOptions = {}
  ): Promise<UploadResultWithMetadata> => {
    try {
      setIsEncrypting(true);
      setEncryptionProgress(0);
      setCurrentOperation('Preparing files...');
     
      const {
        generateThumbnails = true,
        preGeneratedThumbnails,
        ...encryptionOptions
      } = options;

      // Sjekk om vi har pre-genererte thumbnails
      const hasPreGeneratedThumbnails = preGeneratedThumbnails && preGeneratedThumbnails.size > 0;
      const shouldGenerateThumbnails = generateThumbnails && !hasPreGeneratedThumbnails;

      console.log(`🔐 Starting hybrid encryption for ${processedFiles.length} files (thumbnails: ${shouldGenerateThumbnails ? 'generating' : hasPreGeneratedThumbnails ? 'reusing' : 'disabled'})`);
     
      // Encrypt files using AttachmentEncryptionService with thumbnail support
      const encryptionService = AttachmentEncryptionService.getInstance();
      
      // Oppdater processedFiles med pre-genererte thumbnails hvis tilgjengelig
      const filesWithThumbnails = processedFiles.map(file => {
        if (hasPreGeneratedThumbnails && file.metadata?.uri) {
          const preGenerated = preGeneratedThumbnails.get(file.metadata.uri);
          if (preGenerated) {
            return {
              ...file,
              thumbnail: preGenerated
            };
          }
        }
        return file;
      });
      
      const encryptedResults = await encryptionService.encryptFiles(
        filesWithThumbnails,
        conversationId,
        {
          generateThumbnails: shouldGenerateThumbnails,
          onProgress: (progress) => {
            // Reserve 70% of progress bar for encryption
            setEncryptionProgress(Math.round(progress * 0.7));
          },
          onFileProgress: (fileIndex, totalFiles, fileName) => {
            setCurrentOperation(`Processing ${fileIndex}/${totalFiles}: ${fileName}`);
            console.log(`🔐 Processing file ${fileIndex}/${totalFiles}: ${fileName}`);
          },
          ...encryptionOptions
        }
      );

      console.log('🔐🐛 ENCRYPTION SERVICE RESULTS:', {
        resultCount: encryptedResults.length,
        results: encryptedResults.map(result => ({
          fileName: result.fileName,
          optimisticId: result.optimisticId,
          keyInfoKeys: Object.keys(result.keyInfo),
          thumbnailKeyInfoKeys: result.thumbnailKeyInfo ? Object.keys(result.thumbnailKeyInfo) : null,
          hasEncryptedFileData: !!result.encryptedFileData,
          hasThumbnailData: !!result.encryptedThumbnailData
        }))
      });

      // CRITICAL: Capture encryption metadata for thumbnail decryption
      const encryptionMetadata = new Map<string, {
        // Thumbnail encryption data
        thumbnailKeyInfo?: { [userId: string]: string };
        thumbnailIV?: string;
        // Main file encryption data
        fileKeyInfo?: { [userId: string]: string };
        fileIV?: string;
        version?: number;
      }>();

      encryptedResults.forEach(result => {
      if (result.optimisticId) { // Fjern sjekk for kun thumbnailKeyInfo
        encryptionMetadata.set(result.optimisticId, {
          // Thumbnail encryption data
          thumbnailKeyInfo: result.thumbnailKeyInfo,
          thumbnailIV: result.thumbnailIV,
          
          // Main file encryption data (LEGG TIL DISSE)
          fileKeyInfo: result.keyInfo,
          fileIV: result.iv,
          version: result.version
        });
        
        console.log(`🔐📦 Captured encryption metadata for ${result.optimisticId}:`, {
          hasFileKeyInfo: !!result.keyInfo,
          fileKeyCount: Object.keys(result.keyInfo).length,
          hasFileIV: !!result.iv,
          hasThumbnailKeyInfo: !!result.thumbnailKeyInfo,
          thumbnailKeyCount: result.thumbnailKeyInfo ? Object.keys(result.thumbnailKeyInfo).length : 0,
          hasThumbnailIV: !!result.thumbnailIV
        });
      }
    });

      console.log(`🔐📦 Total encryption metadata captured: ${encryptionMetadata.size}/${encryptedResults.length} files`);

      // Log thumbnail statistics
      const stats = encryptionService.getEncryptionStats(encryptedResults);
      console.log('🔐 📊 Encryption stats:', {
        totalFiles: stats.totalFiles,
        filesWithThumbnails: stats.filesWithThumbnails,
        thumbnailSizeKB: Math.round(stats.totalThumbnailSize / 1024),
        compressionRatio: Math.round(stats.compressionRatio * 100) / 100,
        thumbnailSource: hasPreGeneratedThumbnails ? 'reused' : shouldGenerateThumbnails ? 'generated' : 'none'
      });
     
      // Encrypt message text if provided
      setCurrentOperation('Encrypting message text...');
      let encryptedText = null;
      if (messageText) {
        encryptedText = await encryptMessage(messageText, conversationId);
        if (!encryptedText) {
          throw new Error('Failed to encrypt message text');
        }
      }
     
      setEncryptionProgress(80);
      setIsEncrypting(false);
      setIsUploading(true);
      setCurrentOperation('Uploading to server...');
     
      console.log('🔐🐛 FRONTEND SENDING TO BACKEND:', {
        textKeyInfo: encryptedText ? Object.keys(encryptedText.keyInfo) : [],
        attachmentCount: encryptedResults.length,
        attachments: encryptedResults.map(result => ({
          fileName: result.fileName,
          optimisticId: result.optimisticId,
          keyInfoKeys: Object.keys(result.keyInfo),
          thumbnailKeyInfoKeys: result.thumbnailKeyInfo ? Object.keys(result.thumbnailKeyInfo) : null,
          hasThumbnailData: !!result.encryptedThumbnailData,
          thumbnailWidth: result.thumbnailWidth,
          thumbnailHeight: result.thumbnailHeight
        }))
      });
     
      // Upload using JSON API - backend will handle both original files and thumbnails
      const backendResult = await uploadEncryptedAttachmentsJSON({
        encryptedFilesData: encryptedResults.map(result => ({
          fileName: result.fileName,
          fileType: result.fileType,
          fileSize: result.fileSize,
          keyInfo: result.keyInfo,
          iv: result.iv,
          version: result.version,
          encryptedFileData: result.encryptedFileData,
          optimisticId: result.optimisticId,
          
          // Include thumbnail data if available
          ...(result.encryptedThumbnailData && {
            thumbnailKeyInfo: result.thumbnailKeyInfo,
            thumbnailIV: result.thumbnailIV,
            thumbnailWidth: result.thumbnailWidth,
            thumbnailHeight: result.thumbnailHeight,
            encryptedThumbnailData: result.encryptedThumbnailData
          })
        })),
        text: encryptedText?.encryptedText ?? undefined,
        textKeyInfo: encryptedText ? JSON.stringify(encryptedText.keyInfo) : undefined,
        textIV: encryptedText?.iv ?? undefined,
        conversationId,
        receiverId,
        parentMessageId
      });
      
      setEncryptionProgress(100);
      setCurrentOperation('Upload complete!');
      
      const thumbnailCount = encryptedResults.filter(r => r.encryptedThumbnailData).length;
      console.log(`🔐 ✅ Hybrid encrypted attachments uploaded successfully (${thumbnailCount}/${encryptedResults.length} with thumbnails)`);
     
      // Type the backend result using your existing interface
      const typedBackendResult = backendResult as SendEncryptedMessageResponseDTO;

      // Return backend result WITH encryption metadata
      const resultWithMetadata: UploadResultWithMetadata = {
        messageId: typedBackendResult.messageId,
        sentAt: typedBackendResult.sentAt,
        conversationId: typedBackendResult.conversationId,
        attachments: typedBackendResult.attachments || [],
        encryptionMetadata // Include the captured encryption metadata
      };

      console.log('🔐🎯 Returning result with metadata:', {
        messageId: resultWithMetadata.messageId,
        attachmentCount: resultWithMetadata.attachments.length,
        metadataSize: resultWithMetadata.encryptionMetadata.size,
        metadataKeys: Array.from(resultWithMetadata.encryptionMetadata.keys())
      });

      return resultWithMetadata;
    } catch (error) {
      console.error('🔐 ❌ Hybrid encrypted attachment upload failed:', error);
      throw error;
    } finally {
      setIsEncrypting(false);
      setIsUploading(false);
      setEncryptionProgress(0);
      setCurrentOperation('');
    }
  };

  /**
   * Upload with pre-generated thumbnails (no additional generation)
   */
  const uploadWithPreGeneratedThumbnails = async (
    processedFiles: ProcessedFile[],
    conversationId: number,
    preGeneratedThumbnails: Map<string, any>,
    messageText?: string,
    receiverId?: number,
    parentMessageId?: number
  ): Promise<UploadResultWithMetadata> => {
    return uploadEncryptedAttachments(
      processedFiles,
      conversationId,
      messageText,
      receiverId,
      parentMessageId,
      { 
        generateThumbnails: false,
        preGeneratedThumbnails
      }
    );
  };

  /**
   * Quick upload without thumbnails (for cases where speed is prioritized)
   */
  const uploadEncryptedAttachmentsQuick = async (
    processedFiles: ProcessedFile[],
    conversationId: number,
    messageText?: string,
    receiverId?: number,
    parentMessageId?: number
  ): Promise<UploadResultWithMetadata> => {
    return uploadEncryptedAttachments(
      processedFiles,
      conversationId,
      messageText,
      receiverId,
      parentMessageId,
      { generateThumbnails: false }
    );
  };

  /**
   * Upload with custom thumbnail settings
   */
  const uploadEncryptedAttachmentsWithCustomThumbnails = async (
    processedFiles: ProcessedFile[],
    conversationId: number,
    messageText?: string,
    receiverId?: number,
    parentMessageId?: number
  ): Promise<UploadResultWithMetadata> => {
    return uploadEncryptedAttachments(
      processedFiles,
      conversationId,
      messageText,
      receiverId,
      parentMessageId,
      {
        generateThumbnails: true,
      }
    );
  };
 
  return {
    // Main upload function with thumbnail support and encryption metadata
    uploadEncryptedAttachments,
    
    // Convenience functions
    uploadWithPreGeneratedThumbnails,
    uploadEncryptedAttachmentsQuick,
    uploadEncryptedAttachmentsWithCustomThumbnails,
    
    // State
    isEncrypting,
    isUploading,
    encryptionProgress,
    currentOperation, // Shows what's currently happening
    
    // Computed state
    isProcessing: isEncrypting || isUploading
  };
};