import { useCallback } from 'react';
import { MessageDTO } from '@shared/types/MessageDTO';
import { EncryptedMessageDTO } from '@/features/crypto/types/EncryptedMessageTypes';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useBootstrapMessageDecryption } from '@/features/crypto/hooks/useBootstrapMessageDecryption';

export const useBootstrapE2EEHandler = () => {
  const { setCachedMessages } = useChatStore();
  const { decryptAllConversations } = useBootstrapMessageDecryption();

  const createPlaceholderMessage = useCallback((
    encMsg: EncryptedMessageDTO,
    placeholderText: string
  ): MessageDTO => ({
    id: encMsg.id,
    senderId: encMsg.senderId,
    text: placeholderText,
    sentAt: encMsg.sentAt,
    conversationId: encMsg.conversationId,
    attachments: [],
    reactions: encMsg.reactions,
    parentMessageId: encMsg.parentMessageId,
    parentMessageText: encMsg.parentMessagePreview,
    parentSender: encMsg.parentSender,
    sender: encMsg.sender,
    isRejectedRequest: encMsg.isRejectedRequest,
    isNowApproved: encMsg.isNowApproved,
    isSilent: encMsg.isSilent,
    isSystemMessage: encMsg.isSystemMessage,
    isDeleted: encMsg.isDeleted
  }), []);

  const handleE2EENotInitialized = useCallback((
    conversationMessages: { [conversationId: string]: EncryptedMessageDTO[] }
  ) => {
    console.error("🔐❌ E2EE not initialized by AuthService");
    
    for (const [conversationId, encryptedMessages] of Object.entries(conversationMessages)) {
      const convId = Number(conversationId);
      const errorMessages: MessageDTO[] = encryptedMessages.map(encMsg => 
        createPlaceholderMessage(encMsg, '🔐 E2EE not initialized - restart app')
      );
      setCachedMessages(convId, errorMessages);
    }
  }, [createPlaceholderMessage, setCachedMessages]);

  const handleE2EENeedsSetup = useCallback((
    conversationMessages: { [conversationId: string]: EncryptedMessageDTO[] }
  ) => {
    console.log("🔐⚠️ User needs E2EE setup - showing placeholder messages");
    
    for (const [conversationId, encryptedMessages] of Object.entries(conversationMessages)) {
      const convId = Number(conversationId);
      const setupMessages: MessageDTO[] = encryptedMessages.map(encMsg => 
        createPlaceholderMessage(encMsg, '🔐 Set up E2EE to read this message')
      );
      setCachedMessages(convId, setupMessages);
    }
  }, [createPlaceholderMessage, setCachedMessages]);

  const handleE2EENeedsRestore = useCallback((
    conversationMessages: { [conversationId: string]: EncryptedMessageDTO[] }
  ) => {
    console.log("🔐⚠️ User needs E2EE restore - showing placeholder messages");
    
    for (const [conversationId, encryptedMessages] of Object.entries(conversationMessages)) {
      const convId = Number(conversationId);
      const restoreMessages: MessageDTO[] = encryptedMessages.map(encMsg => 
        createPlaceholderMessage(encMsg, '🔐 Restore backup phrase to read this message')
      );
      setCachedMessages(convId, restoreMessages);
    }
  }, [createPlaceholderMessage, setCachedMessages]);

  const handleE2EEReady = useCallback(async (
    conversationMessages: { [conversationId: string]: EncryptedMessageDTO[] }
  ) => {
    // Debug nøkkel-debugging før dekryptering
    if (__DEV__) {
      console.log('🔐🐛 === BOOTSTRAP E2EE DEBUG ===');
      const currentUser = useUserCacheStore.getState().currentUser;
      const crypto = (await import('@/components/ende-til-ende/CryptoService')).CryptoService.getInstance();
      
      if (currentUser?.id) {
        const privateKey = await crypto.getPrivateKey(currentUser.id);
        console.log('🔐🐛 Bootstrap user key info:', {
          userId: currentUser.id,
          hasPrivateKey: !!privateKey,
          privateKeyLength: privateKey?.length,
          keyPreview: privateKey?.substring(0, 20) + '...'
        });
        
        if (privateKey) {
          try {
            await (crypto as any).debugKeyConsistency(currentUser.id);
          } catch (error) {
            console.error('🔐🐛 Key consistency debug failed:', error);
          }
        }
        
        const firstConversation = Object.entries(conversationMessages)[0];
        if (firstConversation && firstConversation[1].length > 0) {
          const [convId, messages] = firstConversation;
          const firstMessage = messages[0];
          
          console.log('🔐🐛 Testing first message:', {
            conversationId: convId,
            messageId: firstMessage.id,
            hasKeyInfo: !!firstMessage.keyInfo,
            keyInfoKeys: Object.keys(firstMessage.keyInfo || {}),
            hasDataForUser: !!firstMessage.keyInfo?.[currentUser.id.toString()],
            encryptedDataLength: firstMessage.keyInfo?.[currentUser.id.toString()]?.length
          });
        }
      }
      console.log('🔐🐛 === DEBUG COMPLETED ===');
    }
    
    // Dekrypter meldinger og attachments
    await decryptAllConversations(conversationMessages);
  }, [decryptAllConversations]);

  const handleConversationMessages = useCallback(async (
    conversationMessages: { [conversationId: string]: EncryptedMessageDTO[] }
  ): Promise<void> => {
    const e2eeState = useBootstrapStore.getState();
    
    if (!e2eeState.e2eeInitialized) {
      await handleE2EENotInitialized(conversationMessages);
    } else if (e2eeState.e2eeError === 'needs_setup') {
      await handleE2EENeedsSetup(conversationMessages);
    } else if (e2eeState.e2eeError === 'needs_restore') {
      await handleE2EENeedsRestore(conversationMessages);
    } else if (e2eeState.e2eeHasKeyPair) {
      await handleE2EEReady(conversationMessages);
    }
  }, [
    handleE2EENotInitialized,
    handleE2EENeedsSetup,
    handleE2EENeedsRestore,
    handleE2EEReady
  ]);

  return {
    handleConversationMessages
  };
};