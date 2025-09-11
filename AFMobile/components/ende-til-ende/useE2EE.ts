// ende-til-ende/useE2EE.ts - Med kun global state
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { CryptoService } from './CryptoService';
import { useCurrentUser } from '../../store/useUserCacheStore';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { 
  ConversationKeyDTO 
} from '@/features/crypto/types/EncryptedMessageTypes';
import { storePublicKey, getConversationKeys } from '@/services/crypto/cryptoService';
import { useUserCacheStore } from '../../store/useUserCacheStore';

export const useE2EE = () => {
  const currentUser = useCurrentUser();
  const crypto = CryptoService.getInstance();

  
  // ✅ Bruk kun global state
  const { 
    e2eeInitialized: isInitialized, 
    e2eeHasKeyPair: hasKeyPair, 
    e2eeError: error,
    e2eeIsGeneratingKeys: isGeneratingKeys,
    setE2EEState,
    setE2EEGenerating
  } = useBootstrapStore();

  // Initialize E2EE - oppdaterer kun global state
  const initializeE2EE = useCallback(async () => {
  // Bruk currentUser først, fallback til token
  const userToUse = useUserCacheStore.getState().currentUser;

  console.log('🔐 DEBUG: E2EE initialization started', {
    hasCurrentUser: !!currentUser,
    finalUserId: userToUse?.id,
    // Fjern userIdFromToken siden vi ikke bruker den
  });

  if (!userToUse?.id) {
    console.error('🔐 ERROR: No user ID available for E2EE init');
    setE2EEState(false, false, 'No user ID available');
    return;
  }

  console.log('🔐 DEBUG: E2EE initialization started', {
    hasCurrentUser: !!currentUser,
    finalUserId: userToUse?.id,
    isGeneratingKeys,
    isInitialized,
    hasKeyPair
  });

  if (!userToUse?.id) {
    console.error('🔐 ERROR: No user ID available for E2EE init');
    setE2EEState(false, false, 'No user ID available');
    return;
  }

    try {
      console.log('🔐 DEBUG: Setting isGeneratingKeys=true, clearing error');
      setE2EEGenerating(true);
      
      // Check if user already has a key pair
      console.log('🔐 DEBUG: Checking for existing private key for user', userToUse.id);
      const existingPrivateKey = await crypto.getPrivateKey(userToUse.id);
     
      console.log('🔐 DEBUG: Existing key check result:', {
        hasExistingKey: !!existingPrivateKey,
        keyLength: existingPrivateKey?.length || 0
      });

      if (existingPrivateKey) {
        console.log('🔐 ✅ Found existing private key, setting initialized state');
        setE2EEState(true, true, null);
        setE2EEGenerating(false);
        return;
      }

      console.log('🔐 🔑 No existing key found - generating new E2EE key pair...');
     
      // Generate new key pair
      console.log('🔐 DEBUG: Calling crypto.generateKeyPair()...');
      const keyPair = await crypto.generateKeyPair();
      
      console.log('🔐 DEBUG: Key pair generated successfully:', {
        hasPublicKey: !!keyPair.publicKey,
        hasPrivateKey: !!keyPair.privateKey,
        publicKeyLength: keyPair.publicKey?.length || 0,
        privateKeyLength: keyPair.privateKey?.length || 0,
        publicKeyPreview: keyPair.publicKey?.substring(0, 100) + '...'
      });
     
      // Store private key securely
      console.log('🔐 DEBUG: Storing private key for user', userToUse.id);
      await crypto.storePrivateKey(keyPair.privateKey, userToUse.id);
      console.log('🔐 ✅ Private key stored successfully');

      // Send public key to backend
      console.log('🔐 DEBUG: Uploading public key to backend...');
      const result = await storePublicKey(keyPair.publicKey);
      
      console.log('🔐 DEBUG: Backend upload result:', {
        success: !!result,
        result: result
      });

      if (!result) {
        console.error('🔐 ERROR: Backend rejected public key upload');
        throw new Error('Failed to store public key on server');
      }

      console.log('🔐 ✅ E2EE initialization completed successfully');
     
      // ✅ Oppdater global state
      setE2EEState(true, true, null);
      setE2EEGenerating(false);

      console.log('🔐 🎉 E2EE fully initialized and ready for use');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'E2EE initialization failed';
      
      console.error('🔐 💥 E2EE initialization failed:', {
        error: errorMessage,
        currentUserId: userToUse.id
      });
     
      // Cleanup on failure
      if (errorMessage.includes('Private key storage failed')) {
        console.log('🔐 🧹 Attempting cleanup after private key storage failure...');
        try {
          await crypto.clearPrivateKey(userToUse.id);
          console.log('🔐 ✅ Cleanup successful');
        } catch (cleanupError) {
          console.error('🔐 💥 Failed to clean up after key storage failure:', cleanupError);
        }
      }
     
      // ✅ Oppdater global state med feil
      setE2EEState(false, false, errorMessage);
      setE2EEGenerating(false);

      // Only show alert in development
      if (__DEV__) {
        Alert.alert(
          'Encryption Setup Failed',
          'Could not set up end-to-end encryption. Please check your device settings and try again.',
          [
            { text: 'Retry', onPress: () => initializeE2EE() },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    }
  }, [currentUser?.id, isGeneratingKeys, crypto, setE2EEState, setE2EEGenerating, isInitialized, hasKeyPair]);

  // Get public keys for conversation participants
  const getConversationKeysWithService = useCallback(async (conversationId: number): Promise<ConversationKeyDTO | null> => {
    try {
      return await getConversationKeys(conversationId);
    } catch (error) {
      console.error('Failed to get conversation keys:', error);
      return null;
    }
  }, []);

  // Rotate keys
  const rotateKeys = useCallback(async (): Promise<boolean> => {
    if (!currentUser) {
      console.error('No current user for key rotation');
      return false;
    }

    try {
      setE2EEGenerating(true);
     
      const newKeyPair = await crypto.rotateKeys(currentUser.id);
     
      const result = await storePublicKey(newKeyPair.publicKey);
      if (!result) {
        throw new Error('Failed to update public key on server');
      }

      setE2EEGenerating(false);
     
      Alert.alert(
        'Keys Rotated',
        'Your encryption keys have been updated successfully.',
        [{ text: 'OK' }]
      );
     
      return true;
    } catch (error) {
      setE2EEGenerating(false);
      console.error('Key rotation failed:', error);
     
      Alert.alert(
        'Key Rotation Failed',
        'Could not rotate your encryption keys. Please try again later.',
        [{ text: 'OK' }]
      );
     
      return false;
    }
  }, [currentUser, crypto, setE2EEGenerating]);

  return {
    // ✅ Global state fra BootstrapStore
    isInitialized,
    hasKeyPair,
    error,
    isGeneratingKeys,
    
    // Funksjoner
    initializeE2EE,
    getConversationKeys: getConversationKeysWithService,
    rotateKeys
  };
};