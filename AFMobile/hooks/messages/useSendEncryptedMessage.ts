// Oppdatert useSendEncryptedMessage.ts med korrekt videokomprimering
import { useState, useCallback } from 'react';
import { useE2EE } from '@/components/ende-til-ende/useE2EE';
import { useCurrentUser } from '../../store/useUserCacheStore';
import { useChatStore } from '../../store/useChatStore';
import { SendEncryptedMessageRequestDTO, DecryptedMessageDTO } from '@/features/crypto/types/EncryptedMessageTypes';
import { validateFiles, RNFile } from '../../utils/files/FileFunctions';
import { useEncryptedAttachments } from '@/features/cryptoAttachments/hooks/useEncryptedAttachments';
import { sendEncryptedMessage } from '@/services/messages/messageService';
import { getFileStats } from '../../utils/files/FileFunctions';
import { useEncryptMessage } from '@/features/crypto/hooks/useEncryptMessage';
import { useOptimisticMessage } from '@/features/OptimsticMessage/hooks/useOptimisticMessage';
import { useThumbnailGenerator, ThumbnailData } from '@/features/cryptoAttachments/hooks/useThumbnailGenerator';
import { SendEncryptedMessageResponseDTO } from '@/features/OptimsticMessage/types/MessagesToBackendTypes';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { useVideoCompression } from '@/features/cryptoAttachments/hooks/useVideoCompression';

// Interface for sending encrypted messages with files
interface SendEncryptedMessagePayload {
  text?: string;
  files?: RNFile[];
  conversationId: number;
  receiverId?: string;
  parentMessageId?: number | null;
}

// Extended response type to include encryption metadata
interface SendEncryptedMessageResponseWithMetadata extends SendEncryptedMessageResponseDTO {
  encryptionMetadata?: Map<string, {
    // Thumbnail encryption data
    thumbnailKeyInfo?: { [userId: string]: string };
    thumbnailIV?: string;
    // Main file encryption data
    fileKeyInfo?: { [userId: string]: string };
    fileIV?: string;
    version?: number;
  }>;
}

const ERROR_MESSAGES = {
  NO_CONTENT: "Meldingen må inneholde tekst eller minst ett vedlegg",
  SEND_FAILED: "Kunne ikke sende kryptert melding",
  ENCRYPTION_FAILED: "Kunne ikke kryptere melding",
  FILE_ENCRYPTION_FAILED: "Kunne ikke kryptere filer",
  NO_E2EE: "Ende-til-ende kryptering ikke tilgjengelig",
  VALIDATION_FAILED: "Ugyldig fil",
  COMPRESSION_FAILED: "Videokomprimering feilet",
  UNKNOWN_ERROR: "Noe gikk galt"
} as const;

export function useSendEncryptedMessage(onSuccess?: (message: DecryptedMessageDTO) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  
  const { isInitialized } = useE2EE();
  const { encryptMessage } = useEncryptMessage();
  const { uploadEncryptedAttachments, isEncrypting, isUploading, encryptionProgress, currentOperation } = useEncryptedAttachments();
  const { createOptimisticMessage } = useOptimisticMessage();
  const { generateThumbnails, isGenerating: isGeneratingThumbnails } = useThumbnailGenerator();
  const { compressFiles, isCompressing, compressionProgress } = useVideoCompression();
  
  const user = useCurrentUser();
  const conversationId = useChatStore((state) => state.currentConversationId);

  const send = useCallback(async (payload: SendEncryptedMessagePayload) => {
    if (!user || !payload.conversationId) return null;

    if (!isInitialized) {
      setError(ERROR_MESSAGES.NO_E2EE);
      return null;
    }

    const hasText = payload.text && payload.text.trim().length > 0;
    const hasFiles = payload.files && payload.files.length > 0;
    
    if (!hasText && !hasFiles) {
      setError(ERROR_MESSAGES.NO_CONTENT);
      return null;
    }

    if (hasFiles && payload.files) {
      const validation = validateFiles(payload.files);
      if (!validation.isValid) {
        setError(validation.error || ERROR_MESSAGES.VALIDATION_FAILED);
        return null;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // 1. COMPRESS VIDEOS FIRST
      let processedFiles = payload.files;
      if (hasFiles && payload.files) {
        setCurrentStage("Compressing videos...");
        console.log(`🗜️ Starting compression for ${payload.files.length} files...`);
        processedFiles = await compressFiles(payload.files, {
          quality: 'medium',
          minimumFileSizeForCompression: 3 * 1024 * 1024 // 3MB threshold
        });
        console.log(`🗜️ Compression complete, using ${processedFiles.length} processed files`);
      }

      // 2. Generate thumbnails from COMPRESSED files
      let thumbnailResult;
      if (hasFiles && processedFiles) {
        setCurrentStage("Generating thumbnails...");
        console.log(`🖼️ Generating thumbnails for ${processedFiles.length} files...`);
        thumbnailResult = await generateThumbnails(processedFiles); // <- Use compressed files
        console.log(`🖼️ Generated ${thumbnailResult.thumbnails.size} thumbnails`);
      }

      // 3. Create optimistic message with COMPRESSED files
      setCurrentStage("Creating message...");
      const optimisticMessage = createOptimisticMessage({
        text: payload.text,
        files: processedFiles, // <- Use compressed files
        conversationId: payload.conversationId,
        user,
        parentMessageId: payload.parentMessageId,
        thumbnails: thumbnailResult?.thumbnails
      });

      // Add directly to store
      const store = useChatStore.getState();
      store.addMessageOptimistic(optimisticMessage);

      // 4. Send to server with COMPRESSED files
      setCurrentStage(hasFiles ? "Encrypting and uploading files..." : "Sending message...");
      let serverResponse: SendEncryptedMessageResponseWithMetadata;
      if (hasFiles && processedFiles) {
        serverResponse = await sendWithEncryptedFiles(
          {
            ...payload,
            files: processedFiles // <- Use compressed files
          }, 
          thumbnailResult?.thumbnailData,
          optimisticMessage.attachments
        );
      } else {
        serverResponse = await sendEncryptedTextOnly(payload);
      }

      if (!serverResponse) {
        throw new Error(ERROR_MESSAGES.SEND_FAILED);
      }

      // 5. Update optimistic message with server data AND encryption metadata
      setCurrentStage("Finalizing...");
      
      store.updateMessageOptimistic(
        payload.conversationId,
        optimisticMessage.optimisticId!,
        {
          ...optimisticMessage,
          id: serverResponse.messageId,
          sentAt: serverResponse.sentAt,
          isOptimistic: false,
          isSending: false,
          sendError: null,
          attachments: optimisticMessage.attachments?.map(optimisticAttachment => {
            const serverAttachment = serverResponse.attachments?.find(
              sa => sa.optimisticId === optimisticAttachment.optimisticId
            );
            
            if (serverAttachment && optimisticAttachment.optimisticId) {
              const encryptionData = serverResponse.encryptionMetadata?.get(
                optimisticAttachment.optimisticId
              );

              console.log(`🔐 Applying encryption metadata for ${optimisticAttachment.optimisticId}:`, {
                hasEncryptionData: !!encryptionData,
                hasThumbnailKeyInfo: !!encryptionData?.thumbnailKeyInfo,
                thumbnailKeyCount: encryptionData?.thumbnailKeyInfo ? Object.keys(encryptionData.thumbnailKeyInfo).length : 0
              });

              return {
                ...optimisticAttachment,
                id: serverAttachment.id,
                fileUrl: serverAttachment.fileUrl,
                thumbnailUrl: serverAttachment.thumbnailUrl,
                isOptimistic: false,
                isUploading: false,
                optimisticId: undefined,
                uploadError: null,
                
                // Main file encryption data
                needsDecryption: !!encryptionData?.fileKeyInfo,
                isEncrypted: !!encryptionData?.fileKeyInfo,
                keyInfo: encryptionData?.fileKeyInfo,
                iv: encryptionData?.fileIV,
                version: encryptionData?.version || 1,
                
                // Thumbnail encryption data
                thumbnailKeyInfo: encryptionData?.thumbnailKeyInfo,
                thumbnailIV: encryptionData?.thumbnailIV,
                
                // Preserve display properties
                thumbnailWidth: optimisticAttachment.thumbnailWidth,
                thumbnailHeight: optimisticAttachment.thumbnailHeight,
                localThumbnailUri: optimisticAttachment.localThumbnailUri,
              };
            }
            return optimisticAttachment;
          })
        }
      );

      console.log(`✅ Updated optimistic message to server message: ${serverResponse.messageId}`);

      // Clear stage on success
      setCurrentStage(null);

      // 6. Return success data for callback
      const resultMessage: DecryptedMessageDTO = {
        id: serverResponse.messageId,
        senderId: user.id,
        text: payload.text ?? null,
        sentAt: serverResponse.sentAt,
        conversationId: payload.conversationId,
        attachments: serverResponse.attachments?.map(serverAttachment => {
          // Find the original file info from PROCESSED files
          const originalFile = processedFiles?.find((file, index) => 
            `attachment_${Date.now()}_${index}`.includes(serverAttachment.optimisticId.split('_').pop() || '')
          );
          
          return {
            id: serverAttachment.id,
            fileUrl: serverAttachment.fileUrl,
            fileName: originalFile?.name || 'Unknown file',
            fileType: originalFile?.type || 'application/octet-stream',
            fileSize: originalFile?.size || 0,
            thumbnailUrl: serverAttachment.thumbnailUrl,
            isOptimistic: false,
            isUploading: false,
            uploadError: null,
          };
        }) || [],
        reactions: [],
        parentMessageId: payload.parentMessageId,
        parentMessageText: payload.text && payload.parentMessageId ? 
          (payload.text.length > 100 ? payload.text.substring(0, 100) + '...' : payload.text) : null,
        parentSender: null,
        sender: user,
        isSystemMessage: false,
        isDeleted: false,
        isDecrypted: true,
        isOptimistic: false
      };

      onSuccess?.(resultMessage);
      return resultMessage;

    } catch (err: unknown) {
      const errorMessage = extractErrorMessage(err);
      console.error("❌ Failed to send encrypted message:", errorMessage);
      setError(errorMessage);
      setCurrentStage(null);
      
      return null;
    } finally {
      setLoading(false);
      setCurrentStage(null);
    }
  }, [
    encryptMessage, 
    isInitialized, 
    user, 
    conversationId, 
    onSuccess, 
    uploadEncryptedAttachments, 
    generateThumbnails,
    compressFiles // Add compressFiles to dependencies
  ]);

  // Send text-only encrypted message
  const sendEncryptedTextOnly = async (payload: SendEncryptedMessagePayload): Promise<SendEncryptedMessageResponseWithMetadata> => {
    const textToEncrypt = payload.text?.trim() || null;
    const encrypted = await encryptMessage(textToEncrypt, payload.conversationId);
    if (!encrypted) {
      throw new Error(ERROR_MESSAGES.ENCRYPTION_FAILED);
    }

    const request: SendEncryptedMessageRequestDTO = {
      encryptedText: encrypted.encryptedText || "",
      keyInfo: encrypted.keyInfo,
      iv: encrypted.iv,
      version: encrypted.version,
      conversationId: payload.conversationId,
      receiverId: payload.receiverId,
      parentMessageId: payload.parentMessageId,
      parentMessagePreview: payload.text && payload.parentMessageId ? 
        (payload.text.length > 100 ? payload.text.substring(0, 100) + '...' : payload.text) : null
    };

    const response = await sendEncryptedMessage(request);
    if (!response) {
      throw new Error('Failed to send encrypted message');
    }

    return {
      messageId: response.id,
      sentAt: response.sentAt,
      conversationId: response.conversationId,
      attachments: [],
      encryptionMetadata: new Map()
    };
  };

  // Send message with encrypted files
  const sendWithEncryptedFiles = async (
    payload: SendEncryptedMessagePayload, 
    thumbnailData?: Map<string, ThumbnailData>,
    optimisticAttachments?: AttachmentDto[]
  ): Promise<SendEncryptedMessageResponseWithMetadata> => {
    if (!user || !payload.files || payload.files.length === 0) {
      throw new Error("No files provided");
    }

    try {
      const fileStats = getFileStats(payload.files);
      const thumbnailCount = thumbnailData?.size || 0;
      console.log(`🔐 Encrypting ${fileStats.fileCount} files with ${thumbnailCount} pre-generated thumbnails`);

      // Process files for encryption WITH optimistic IDs
      const processedFiles = await Promise.all(
        payload.files.map(async (rnFile, index) => {
          const response = await fetch(rnFile.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
        
          const arrayBuffer = await response.arrayBuffer();
        
          // Include pre-generated thumbnail data
          const thumbnail = thumbnailData?.get(rnFile.uri);
          if (thumbnail) {
            console.log(`🖼️ Including pre-generated thumbnail for ${rnFile.name}`);
          }

          // Find matching optimistic attachment by localUri
          const optimisticAttachment = optimisticAttachments?.find(att => 
            att.localUri === rnFile.uri
          );
        
          return {
            buffer: arrayBuffer,
            metadata: {
              name: rnFile.name,
              type: rnFile.type,
              size: rnFile.size || arrayBuffer.byteLength,
              uri: rnFile.uri
            },
            thumbnail,
            optimisticId: optimisticAttachment?.optimisticId
          };
        })
      );

      const result = await uploadEncryptedAttachments(
        processedFiles,
        payload.conversationId,
        payload.text,
        typeof payload.receiverId === 'string' ? parseInt(payload.receiverId) : payload.receiverId,
        payload.parentMessageId ?? undefined,
        {
          generateThumbnails: false,
          preGeneratedThumbnails: thumbnailData
        }
      );
      
      console.log('🔐 Received upload result with encryption metadata:', {
        hasMetadata: !!result.encryptionMetadata,
        metadataSize: result.encryptionMetadata?.size || 0,
        attachmentCount: result.attachments?.length || 0
      });

      return result;
    } catch (err) {
      console.error("Failed to send encrypted files:", err);
      throw new Error(ERROR_MESSAGES.FILE_ENCRYPTION_FAILED);
    }
  };

  // Combine progress information including compression
  const combinedProgress = {
    stage: currentStage,
    isCompressing,
    compressionProgress,
    isGeneratingThumbnails,
    isEncrypting,
    isUploading,
    encryptionProgress,
    currentOperation
  };
  
  return { 
    send, 
    loading: loading || isCompressing || isEncrypting || isUploading || isGeneratingThumbnails,
    error,
    isE2EEReady: isInitialized,
    encryptionProgress: combinedProgress
  };
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      return parsed.details || parsed.message || err.message;
    } catch {
      return err.message;
    }
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}