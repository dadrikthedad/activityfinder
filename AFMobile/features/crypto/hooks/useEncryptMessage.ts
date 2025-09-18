// hooks/useEncryptMessage.ts
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { EncryptMessageService } from '@/features/crypto/services/EncryptMessageService';
import { conversationKeysCache } from '../storage/ConversationKeyCache';
import { ConversationKeyDTO } from '@/features/crypto/types/EncryptedMessageTypes';

export const useEncryptMessage = () => {
  const encryptMessageService = EncryptMessageService.getInstance();

  // Get public keys for conversation participants (now with caching)
  const getConversationKeysWithService = useCallback(async (conversationId: number): Promise<ConversationKeyDTO | null> => {
    try {
      return await conversationKeysCache.getKeys(conversationId); // Bruk cache i stedet
    } catch (error) {
      console.error('Failed to get conversation keys:', error);
      return null;
    }
  }, []);

  // resten av koden forblir uendret...
  const encryptMessage = useCallback(async (
    plaintext: string | null,
    conversationId: number
  ): Promise<{ encryptedText: string | null; keyInfo: { [userId: string]: string }; iv: string; version: number } | null> => {
    try {
      const conversationKeys = await getConversationKeysWithService(conversationId);
      if (!conversationKeys || !conversationKeys.participantKeys?.length) {
        throw new Error('No participant keys available for encryption');
      }

      const recipientKeys: { [userId: string]: string } = {};
      conversationKeys.participantKeys.forEach(key => {
        recipientKeys[key.userId.toString()] = key.publicKey;
      });

      console.log(`Encrypting message for ${Object.keys(recipientKeys).length} recipients`);
     
      const encrypted = await encryptMessageService.encryptMessage(plaintext, recipientKeys);
     
      return {
        encryptedText: encrypted.encryptedText,
        keyInfo: encrypted.keyInfo,
        iv: encrypted.iv,
        version: encrypted.version
      };
    } catch (error) {
      console.error('Failed to encrypt message:', error);
     
      Alert.alert(
        'Encryption Failed',
        'Could not encrypt your message. Please try again.',
        [{ text: 'OK' }]
      );
     
      return null;
    }
  }, [encryptMessageService, getConversationKeysWithService]);

  return {
    encryptMessage,
    getConversationKeys: getConversationKeysWithService
  };
};