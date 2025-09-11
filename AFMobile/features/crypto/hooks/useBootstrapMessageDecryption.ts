import { useCallback } from 'react';
import { MessageDTO } from '@shared/types/MessageDTO';
import { EncryptedMessageDTO } from '@/features/crypto/types/EncryptedMessageTypes';
import { useDecryptMessage } from '@/features/crypto/hooks/useDecryptMessage';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useChatStore } from '@/store/useChatStore';

interface DecryptionResult {
  success: boolean;
  message: MessageDTO;
  index: number;
  error?: any;
}

export const useBootstrapMessageDecryption = () => {
  const { decryptMessage } = useDecryptMessage();
  const { setCachedMessages } = useChatStore();

  const decryptConversationMessages = useCallback(async (
    conversationId: string,
    encryptedMessages: EncryptedMessageDTO[]
  ): Promise<void> => {
    const convId = Number(conversationId);
    
    // Check if conversation already has decrypted messages
    const existingMessages = useChatStore.getState().cachedMessages[convId];
    if (existingMessages && existingMessages.length > 0) {
      console.log(`🔐 Conversation ${convId} already has ${existingMessages.length} messages, skipping decrypt`);
      return;
    }

    if (!encryptedMessages || encryptedMessages.length === 0) return;

    console.log(`🔐⚡ Starting parallel decryption of ${encryptedMessages.length} messages for conversation ${convId}...`);
    
    // PARALLELL DEKRYPTERING - alle meldinger dekrypteres samtidig
    const decryptionPromises = encryptedMessages.map(async (encryptedMsg, index) => {
      try {
        const currentUser = useUserCacheStore.getState().currentUser;
        if (!currentUser) {
          throw new Error('Current user not set');
        }

        // Debug dekrypteringsoperasjon i development
        if (__DEV__ && index < 3) {
          console.log(`🔐🐛 Decrypting message ${index}:`, {
            messageId: encryptedMsg.id,
            userId: currentUser.id,
            hasKeyInfo: !!encryptedMsg.keyInfo,
            hasUserData: !!encryptedMsg.keyInfo?.[currentUser.id.toString()],
            encryptedTextEmpty: !encryptedMsg.encryptedText || encryptedMsg.encryptedText === "",
            version: encryptedMsg.version || 1,
            attachmentCount: encryptedMsg.encryptedAttachments?.length || 0,
            attachmentsWithThumbnails: encryptedMsg.encryptedAttachments?.filter(att => att.encryptedThumbnailData).length || 0
          });
        }

        const decrypted = await decryptMessage(encryptedMsg, currentUser.id);
        
        if (decrypted) {
          // 🔄 FASE 1: Behold kun attachment metadata - IKKE dekrypter filer, men inkluder thumbnail info
          const processedAttachments = encryptedMsg.encryptedAttachments?.map(encAttachment => ({
            fileUrl: encAttachment.encryptedFileUrl, // Behold encrypted URL
            fileType: encAttachment.fileType,
            fileName: encAttachment.fileName,
            fileSize: encAttachment.fileSize,
            isEncrypted: true,
            needsDecryption: true, // Ny flag for lazy loading
            
            // Include encryption metadata for lazy decryption of original file
            keyInfo: encAttachment.keyInfo,
            iv: encAttachment.iv,
            version: encAttachment.version || 1,
            
            // 🆕 THUMBNAIL METADATA - inkluder thumbnail info for lazy thumbnail decryption
            thumbnailUrl: encAttachment.encryptedThumbnailUrl,
            thumbnailWidth: encAttachment.thumbnailWidth,
            thumbnailHeight: encAttachment.thumbnailHeight,
            thumbnailKeyInfo: encAttachment.thumbnailKeyInfo || undefined,
            thumbnailIV: encAttachment.thumbnailIV
          })) || [];

          // Konverter DecryptedMessageDTO til MessageDTO format med prosesserte attachments
          const messageDto: MessageDTO = {
            id: decrypted.id,
            senderId: decrypted.senderId,
            text: decrypted.text,
            sentAt: decrypted.sentAt,
            conversationId: decrypted.conversationId,
            attachments: processedAttachments,
            reactions: decrypted.reactions,
            parentMessageId: decrypted.parentMessageId,
            parentMessageText: decrypted.parentMessageText,
            parentSender: decrypted.parentSender,
            sender: decrypted.sender,
            isRejectedRequest: decrypted.isRejectedRequest,
            isNowApproved: decrypted.isNowApproved,
            isSilent: decrypted.isSilent,
            isSystemMessage: decrypted.isSystemMessage,
            isDeleted: decrypted.isDeleted
          };
          
          // Debug suksessful dekryptering med thumbnail info
          if (__DEV__ && index < 3) {
            const thumbnailCount = messageDto.attachments.filter(att => att.thumbnailUrl).length;
            console.log(`🔐🐛 Decryption SUCCESS for message ${index}:`, {
              messageId: decrypted.id,
              textLength: decrypted.text?.length || 0,
              textPreview: decrypted.text?.substring(0, 30) || 'null',
              attachmentCount: messageDto.attachments.length,
              encryptedAttachments: messageDto.attachments.filter(att => att.needsDecryption).length,
              attachmentsWithThumbnails: thumbnailCount
            });
          }
          
          return { success: true, message: messageDto, index };
        } else {
          throw new Error('Decryption returned null');
        }
      } catch (error) {
        console.error(`🔐❌ Failed to decrypt message ${index} in conversation ${convId}:`, error);
        
        // Debug detaljert feil
        if (__DEV__) {
          console.log(`🔐🐛 Decryption FAILED for message ${index}:`, {
            messageId: encryptedMsg.id,
            error: error instanceof Error ? error.message : String(error),
            hasKeyInfo: !!encryptedMsg.keyInfo,
            keyInfoKeys: Object.keys(encryptedMsg.keyInfo || {}),
            encryptedTextLength: encryptedMsg.encryptedText?.length || 0,
            attachmentCount: encryptedMsg.encryptedAttachments?.length || 0
          });
        }
        
        // Returner failed message med basic attachment info (ingen thumbnail data for failed decryption)
        const failedMessage: MessageDTO = {
          id: encryptedMsg.id,
          senderId: encryptedMsg.senderId,
          text: '🔐 Failed to decrypt message',
          sentAt: encryptedMsg.sentAt,
          conversationId: encryptedMsg.conversationId,
          attachments: encryptedMsg.encryptedAttachments?.map(att => ({
            fileUrl: att.encryptedFileUrl,
            fileType: att.fileType,
            fileName: att.fileName,
            fileSize: att.fileSize,
            isEncrypted: true,
            needsDecryption: false, // Don't attempt decryption for failed messages
            // No thumbnail info for failed decryption
          })) || [],
          reactions: encryptedMsg.reactions,
          parentMessageId: encryptedMsg.parentMessageId,
          parentMessageText: encryptedMsg.parentMessagePreview,
          parentSender: encryptedMsg.parentSender,
          sender: encryptedMsg.sender,
          isRejectedRequest: encryptedMsg.isRejectedRequest,
          isNowApproved: encryptedMsg.isNowApproved,
          isSilent: encryptedMsg.isSilent,
          isSystemMessage: encryptedMsg.isSystemMessage,
          isDeleted: encryptedMsg.isDeleted
        };
        
        return { success: false, message: failedMessage, index, error };
      }
    });
    
    // Prosesser resultater og behold original rekkefølge
    const results = await Promise.allSettled(decryptionPromises);
    const decryptedMessages: MessageDTO[] = [];
    let successCount = 0;
    let failureCount = 0;
    let encryptedAttachmentCount = 0;
    let thumbnailCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        decryptedMessages.push(result.value.message);
        if (result.value.success) {
          successCount++;
          // Tell encrypted attachments som venter på dekryptering
          const pendingAttachments = result.value.message.attachments?.filter(att => att.needsDecryption)?.length || 0;
          encryptedAttachmentCount += pendingAttachments;
          
          // Tell thumbnails som er tilgjengelige
          const attachmentsWithThumbnails = result.value.message.attachments?.filter(att => att.thumbnailUrl)?.length || 0;
          thumbnailCount += attachmentsWithThumbnails;
        } else {
          failureCount++;
        }
      } else {
        console.error(`🔐💥 Promise rejection for message ${index}:`, result.reason);
        failureCount++;
        
        // Legg til generisk feilmelding
        const fallbackMessage: MessageDTO = {
          id: encryptedMessages[index]?.id || -1,
          senderId: encryptedMessages[index]?.senderId || null,
          text: '🔐 Critical decryption failure',
          sentAt: encryptedMessages[index]?.sentAt || new Date().toISOString(),
          conversationId: convId,
          attachments: [],
          reactions: [],
          isSystemMessage: false,
          isDeleted: false
        };
        
        decryptedMessages.push(fallbackMessage);
      }
    });
    
    // Cache de dekrypterte meldingene
    setCachedMessages(convId, decryptedMessages);
    console.log(`🔐✅ Parallel decryption completed for conversation ${convId}: ${successCount} successful, ${failureCount} failed, ${decryptedMessages.length} total, ${encryptedAttachmentCount} encrypted attachments waiting for lazy load, ${thumbnailCount} thumbnails available`);
  }, [decryptMessage, setCachedMessages]);

  const decryptAllConversations = useCallback(async (
    conversationMessages: { [conversationId: string]: EncryptedMessageDTO[] }
  ): Promise<void> => {
    console.log("🔐 Starting message decryption (text only, attachments and thumbnails deferred)...");
    
    for (const [conversationId, encryptedMessages] of Object.entries(conversationMessages)) {
      await decryptConversationMessages(conversationId, encryptedMessages);
    }
    
    console.log(`🔐✅ Message decryption completed for ${Object.keys(conversationMessages).length} conversations (attachments and thumbnails will be decrypted on demand)`);
  }, [decryptConversationMessages]);

  return {
    decryptConversationMessages,
    decryptAllConversations
  };
};