import { useCallback } from 'react';
import { CryptoService } from './CryptoService';
import { useCurrentUser } from '../../store/useUserCacheStore';
import { useE2EEStore } from '@/store/useE2EEStore';
import { ConversationKeyDTO } from '@/features/crypto/types/EncryptedMessageTypes';
import { storePublicKey, getConversationKeys } from '@/services/crypto/cryptoService';

export const useE2EE = () => {
  const currentUser = useCurrentUser();
  const crypto = CryptoService.getInstance();

  const {
    initialized: isInitialized,
    hasKeyPair,
    error,
    isGeneratingKeys,
    setE2EEGenerating,
  } = useE2EEStore();

  const getConversationKeysWithService = useCallback(async (conversationId: number): Promise<ConversationKeyDTO | null> => {
    try {
      return await getConversationKeys(conversationId);
    } catch (error) {
      console.error('Failed to get conversation keys:', error);
      return null;
    }
  }, []);

  const rotateKeys = useCallback(async (): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      setE2EEGenerating(true);
      const newKeyPair = await crypto.rotateKeys(currentUser.id.toString());
      const result = await storePublicKey(newKeyPair.publicKey);
      if (!result) throw new Error('Failed to update public key on server');
      setE2EEGenerating(false);
      return true;
    } catch (error) {
      setE2EEGenerating(false);
      console.error('Key rotation failed:', error);
      return false;
    }
  }, [currentUser, crypto, setE2EEGenerating]);

  return {
    isInitialized,
    hasKeyPair,
    error,
    isGeneratingKeys,
    getConversationKeys: getConversationKeysWithService,
    rotateKeys,
  };
};
