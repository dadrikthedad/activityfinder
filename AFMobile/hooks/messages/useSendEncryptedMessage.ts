// hooks/useSendEncryptedMessage.ts
import { useState, useCallback } from 'react';
import { useE2EE } from '@/components/ende-til-ende/useE2EE';
import { useCurrentUser } from '../../store/useUserCacheStore';
import { useChatStore } from '../../store/useChatStore';
import { MessageDTO } from '@shared/types/MessageDTO';
import { SendEncryptedMessageRequestDTO, DecryptedMessageDTO } from '@/components/ende-til-ende/EncryptedMessageDto';
import { validateFiles, RNFile } from '../../utils/files/FileFunctions';
import { useEncryptedAttachments } from '@/features/cryptoAttachments/hooks/useEncryptedAttachments';
import authServiceNative from '@/services/user/authServiceNative';
import { API_BASE_URL } from '../../constants/routes';
import { sendEncryptedMessage } from '@/services/messages/messageService';
import { getFileStats } from '../../utils/files/FileFunctions';

// Interface for sending encrypted messages with files
interface SendEncryptedMessagePayload {
  text?: string; // nullable for attachment-only
  files?: RNFile[];
  conversationId: number;
  receiverId?: string;
  parentMessageId?: number | null;
}

const ERROR_MESSAGES = {
  NO_CONTENT: "Meldingen må inneholde tekst eller minst ett vedlegg",
  SEND_FAILED: "Kunne ikke sende kryptert melding",
  ENCRYPTION_FAILED: "Kunne ikke kryptere melding",
  FILE_ENCRYPTION_FAILED: "Kunne ikke kryptere filer",
  NO_E2EE: "Ende-til-ende kryptering ikke tilgjengelig",
  VALIDATION_FAILED: "Ugyldig fil",
  UNKNOWN_ERROR: "Noe gikk galt"
} as const;

export function useSendEncryptedMessage(onSuccess?: (message: DecryptedMessageDTO) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    encryptMessage, 
    isInitialized, 
    hasKeyPair, 
    error: e2eeError,
    isGeneratingKeys 
  } = useE2EE();
  
  const {
    uploadEncryptedAttachments, // ✅ Dette er nu den rensede metoden
    isEncrypting,
    isUploading,
    encryptionProgress
  } = useEncryptedAttachments();
  
  const user = useCurrentUser();
  const conversationId = useChatStore((state) => state.currentConversationId);

  const send = useCallback(async (payload: SendEncryptedMessagePayload) => {
    if (!user || !payload.conversationId) return null;

    // Check if E2EE is ready
    if (!isInitialized) {
      setError(ERROR_MESSAGES.NO_E2EE);
      return null;
    }

    // Validate content
    const hasText = payload.text && payload.text.trim().length > 0;
    const hasFiles = payload.files && payload.files.length > 0;
    
    if (!hasText && !hasFiles) {
      setError(ERROR_MESSAGES.NO_CONTENT);
      return null;
    }

    // Validate files if present
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
      let result: any;

      if (hasFiles && payload.files) {
        // Send message with encrypted attachments using hybrid approach
        result = await sendWithEncryptedFiles(payload);
      } else {
        // Send text-only encrypted message
        result = await sendEncryptedTextOnly(payload);
      }

      if (!result) {
        throw new Error(ERROR_MESSAGES.SEND_FAILED);
      }

      // Create a decrypted version for local use
      const decryptedMessage: DecryptedMessageDTO = {
        id: result.messageId || result.id,
        senderId: user.id,
        text: payload.text ?? null, 
        sentAt: result.sentAt || new Date().toISOString(),
        conversationId: payload.conversationId,
        attachments: result.attachments || [], 
        reactions: result.reactions || [],
        parentMessageId: payload.parentMessageId,
        parentMessageText: payload.text && payload.parentMessageId ? 
          (payload.text.length > 100 ? payload.text.substring(0, 100) + '...' : payload.text) : null,
        parentSender: result.parentSender || null,
        sender: result.sender || user,
        isSystemMessage: false,
        isDeleted: false,
        isDecrypted: true,
        isOptimistic: false
      };

      // Handle optimistic message mapping if needed
      if (conversationId !== null) {
        const store = useChatStore.getState();
        const allMessages = [
          ...(store.cachedMessages[conversationId] || []),
          ...(store.liveMessages[conversationId] || [])
        ];
        
        // Find matching optimistic message
        const optimisticMessage = allMessages.find(msg => 
          msg.isOptimistic && 
          msg.text === (payload.text ?? null) && 
          msg.senderId === user.id &&
          Math.abs(new Date(msg.sentAt).getTime() - new Date(decryptedMessage.sentAt).getTime()) < 10000
        );

        if (optimisticMessage?.optimisticId) {
          store.registerOptimisticMapping(optimisticMessage.optimisticId, decryptedMessage.id);
          
          // Handle attachment mappings for encrypted files
          if (hasFiles && optimisticMessage.attachments && decryptedMessage.attachments) {
            decryptedMessage.attachments.forEach((serverAttachment: any, index: number) => {
              const optimisticAttachment = optimisticMessage.attachments[index];
              if (optimisticAttachment?.isOptimistic && optimisticAttachment.optimisticId) {
                store.registerOptimisticAttachmentMapping(
                  optimisticAttachment.optimisticId,
                  serverAttachment.encryptedFileUrl || serverAttachment.fileUrl
                );
              }
            });
          }
        }
      }
      
      onSuccess?.(decryptedMessage);
      return decryptedMessage;

    } catch (err: unknown) {
      const errorMessage = extractErrorMessage(err);
      console.error("❌ Failed to send encrypted message:", errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [encryptMessage, isInitialized, user, conversationId, onSuccess, uploadEncryptedAttachments]); // ✅ Oppdatert dependency

  // Send text-only encrypted message (uendret)
  const sendEncryptedTextOnly = async (payload: SendEncryptedMessagePayload) => {
    const textToEncrypt = payload.text?.trim() || null;
    const encrypted = await encryptMessage(textToEncrypt, payload.conversationId);
    if (!encrypted) {
      throw new Error(ERROR_MESSAGES.ENCRYPTION_FAILED);
    }

    let parentPreview: string | null = null;
    if (payload.parentMessageId && payload.text) {
      parentPreview = payload.text.length > 100 
        ? payload.text.substring(0, 100) + '...'
        : payload.text;
    }

    const request: SendEncryptedMessageRequestDTO = {
      encryptedText: encrypted.encryptedText || "",
      keyInfo: encrypted.keyInfo,
      iv: encrypted.iv,
      version: encrypted.version,
      conversationId: payload.conversationId,
      receiverId: payload.receiverId,
      parentMessageId: payload.parentMessageId,
      parentMessagePreview: parentPreview
    };

    const response = await sendEncryptedMessage(request);
    if (!response) {
      throw new Error('Failed to send encrypted message');
    }

    return response;
  };

  // Send message with encrypted files - KORRIGERT
  const sendWithEncryptedFiles = async (payload: SendEncryptedMessagePayload) => {
    if (!payload.files || payload.files.length === 0) {
      throw new Error("No files provided");
    }

    try {
      const fileStats = getFileStats(payload.files);
      console.log(`🔐 Encrypting ${fileStats.fileCount} files (${fileStats.totalSizeFormatted})`);

      // Convert RNFile to ArrayBuffer with metadata
      const processFileForEncryption = async (rnFile: RNFile) => {
        try {
          console.log(`📱 Processing file: ${rnFile.name} (${rnFile.size || 'unknown size'} bytes)`);
        
          const response = await fetch(rnFile.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
        
          const arrayBuffer = await response.arrayBuffer();
        
          return {
            buffer: arrayBuffer,
            metadata: {
              name: rnFile.name,
              type: rnFile.type,
              size: rnFile.size || arrayBuffer.byteLength,
              uri: rnFile.uri
            }
          };
        } catch (error) {
          throw new Error(`Failed to process file ${rnFile.name}: ${error}`);
        }
      };

      const processedFiles = await Promise.all(
        payload.files.map(file => processFileForEncryption(file))
      );

      console.log(`🔐 Successfully processed ${processedFiles.length} files for encryption`);

      // ✅ Bruk den rensede uploadEncryptedAttachments metoden
      const result = await uploadEncryptedAttachments(
        processedFiles,
        payload.conversationId,
        payload.text,
        typeof payload.receiverId === 'string' ? parseInt(payload.receiverId) : payload.receiverId,
        payload.parentMessageId ?? undefined
      );

      return result;
    } catch (err) {
      console.error("Failed to send encrypted files:", err);
      throw new Error(ERROR_MESSAGES.FILE_ENCRYPTION_FAILED);
    }
  };
  
  return { 
    send, 
    loading: loading || isEncrypting || isUploading,
    error,
    isE2EEReady: isInitialized,
    e2eeError,
    encryptionProgress
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