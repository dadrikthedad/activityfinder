// hooks/useDecryptMessage.ts
import { useCallback } from 'react';
import { EncryptMessageService } from '@/features/crypto/services/EncryptMessageService';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { 
  EncryptedMessageDTO, 
  DecryptedMessageDTO 
} from '@/features/crypto/types/EncryptedMessageTypes';

export const useDecryptMessage = () => {
  const currentUser = useCurrentUser();
  const encryptMessageService = EncryptMessageService.getInstance();

  // Decrypt message for display
  const decryptMessage = useCallback(async (
    encryptedMessage: EncryptedMessageDTO,
    userId?: number 
  ): Promise<DecryptedMessageDTO | null> => {
    const userIdToUse = userId || currentUser?.id;
    
    if (!userIdToUse) {
      console.error('No current user for decryption');
      return null;
    }

    try {
      let decryptedText: string | null = null;

      const hasEncryptedDataForUser = encryptedMessage.keyInfo && 
                                 encryptedMessage.keyInfo[userIdToUse.toString()] &&
                                 encryptedMessage.encryptedText !== null &&
                                 encryptedMessage.encryptedText !== "";

      if (hasEncryptedDataForUser) {
        console.log('🔐 DEBUG: Found encrypted data for user', userIdToUse, {
          keyInfoSize: Object.keys(encryptedMessage.keyInfo).length,
          hasDataForUser: !!encryptedMessage.keyInfo[userIdToUse.toString()],
          encryptedDataLength: encryptedMessage.keyInfo[userIdToUse.toString()]?.length
        });

        decryptedText = await encryptMessageService.decryptMessage({
          encryptedText: encryptedMessage.encryptedText,
          keyInfo: encryptedMessage.keyInfo,
          iv: encryptedMessage.iv,
          version: encryptedMessage.version || 1
        }, userIdToUse);

        console.log('🔐 DEBUG: Decryption attempt result:', {
          success: decryptedText !== null,
          textLength: decryptedText?.length || 0,
          textPreview: decryptedText?.substring(0, 50) || 'null'
        });

        if (decryptedText === null && hasEncryptedDataForUser) {
          console.warn(`Failed to decrypt message ${encryptedMessage.id} for user ${userIdToUse}`);
          return {
            ...encryptedMessage,
            text: null,
            attachments: [],
            isDecrypted: true,
            decryptionError: 'Could not decrypt this message'
          } as DecryptedMessageDTO;
        }
      } else {
        console.log('🔐 DEBUG: No encrypted data for user', userIdToUse, {
          messageId: encryptedMessage.id,
          hasKeyInfo: !!encryptedMessage.keyInfo,
          keyInfoKeys: Object.keys(encryptedMessage.keyInfo || {})
        });
      }

      const decryptedAttachments = encryptedMessage.encryptedAttachments?.map(encAttachment => ({
        fileUrl: encAttachment.encryptedFileUrl,
        fileType: encAttachment.fileType,
        fileName: encAttachment.fileName,
        fileSize: encAttachment.fileSize
      })) || [];

      return {
        id: encryptedMessage.id,
        senderId: encryptedMessage.senderId,
        text: decryptedText,
        sentAt: encryptedMessage.sentAt,
        conversationId: encryptedMessage.conversationId,
        attachments: decryptedAttachments,
        reactions: encryptedMessage.reactions || [],
        parentMessageId: encryptedMessage.parentMessageId,
        parentMessageText: encryptedMessage.parentMessagePreview,
        parentSender: encryptedMessage.parentSender,
        sender: encryptedMessage.sender,
        isRejectedRequest: encryptedMessage.isRejectedRequest,
        isNowApproved: encryptedMessage.isNowApproved,
        isSilent: encryptedMessage.isSilent,
        isSystemMessage: encryptedMessage.isSystemMessage || false,
        isDeleted: encryptedMessage.isDeleted || false,
        isDecrypted: true,
        isOptimistic: encryptedMessage.isOptimistic,
        optimisticId: encryptedMessage.optimisticId,
        isSending: encryptedMessage.isSending,
        sendError: encryptedMessage.sendError
      };

    } catch (error) {
      console.error('Failed to decrypt message:', error);
      
      return {
        ...encryptedMessage,
        text: null,
        attachments: [],
        isDecrypted: true,
        decryptionError: 'Decryption failed'
      } as DecryptedMessageDTO;
    }
  }, [currentUser, encryptMessageService]);

  return {
    decryptMessage
  };
};