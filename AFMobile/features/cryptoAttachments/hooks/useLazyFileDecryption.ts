// features/cryptoAttachments/hooks/useLazyFileDecryption.ts
import { useState, useCallback, useRef } from 'react';
import { AttachmentDecryptionService } from '@/features/cryptoAttachments/services/AttachmentDecryptionService';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { AttachmentDto } from '@shared/types/MessageDTO';

interface DecryptionState {
  isLoading: boolean;
  error: string | null;
  decryptedUrl: string | null;
}

export const useLazyFileDecryption = () => {
  const currentUser = useCurrentUser();
  const [decryptionStates, setDecryptionStates] = useState<Map<string, DecryptionState>>(new Map());
  const decryptionService = useRef(AttachmentDecryptionService.getInstance());

  const getDecryptionState = useCallback((fileUrl: string): DecryptionState => {
    return decryptionStates.get(fileUrl) || {
      isLoading: false,
      error: null,
      decryptedUrl: null
    };
  }, [decryptionStates]);

  const updateDecryptionState = useCallback((fileUrl: string, updates: Partial<DecryptionState>) => {
    setDecryptionStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(fileUrl) || { isLoading: false, error: null, decryptedUrl: null };
      newMap.set(fileUrl, { ...currentState, ...updates });
      return newMap;
    });
  }, []);

  const decryptFile = useCallback(async (attachment: AttachmentDto): Promise<string | null> => {
    if (!currentUser?.id) {
      console.error('🔐📱 No current user for lazy decryption');
      return null;
    }

    if (!attachment.needsDecryption) {
      // File is not encrypted or already decrypted
      return attachment.fileUrl;
    }

    const fileKey = attachment.fileUrl;
    const currentState = getDecryptionState(fileKey);

    // Return cached result if available
    if (currentState.decryptedUrl) {
      console.log(`🔐📱 ♻️ Using cached decryption: ${attachment.fileName}`);
      return currentState.decryptedUrl;
    }

    // Skip if already loading
    if (currentState.isLoading) {
      console.log(`🔐📱 ⏳ Decryption already in progress: ${attachment.fileName}`);
      return null;
    }

    console.log(`🔐📱 🔄 Starting lazy decryption: ${attachment.fileName}`);

    // Set loading state
    updateDecryptionState(fileKey, {
      isLoading: true,
      error: null
    });

    try {
      // Create EncryptedAttachmentData from AttachmentDto
      // NOTE: This requires additional metadata from the original encrypted message
      // For now, we'll need to pass this through the attachment object
      const encryptedAttachment = {
        encryptedFileUrl: attachment.fileUrl,
        fileType: attachment.fileType,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize || 0,
        keyInfo: attachment.keyInfo || {},
        iv: attachment.iv || '', 
        version: attachment.version || 1 
        };

        console.log(`🔐📱 DEBUG attachment keyInfo:`, {
          fileName: attachment.fileName,
          hasKeyInfo: !!attachment.keyInfo,
          keyInfoKeys: attachment.keyInfo ? Object.keys(attachment.keyInfo) : [],
          hasIV: !!attachment.iv,
          userId: currentUser.id
        });

      const result = await decryptionService.current.decryptAttachment(
        encryptedAttachment,
        currentUser.id
      );

      if (result?.fileUrl) {
        console.log(`🔐📱 ✅ Lazy decryption completed: ${attachment.fileName}`);

        if (result.fileUrl === attachment.fileUrl) {
          throw new Error('Decryption returned same URL - decryption likely failed');
        }
        
        // Update state with success
        updateDecryptionState(fileKey, {
          isLoading: false,
          decryptedUrl: result.fileUrl,
          error: null
        });

        return result.fileUrl;
      } else {
        throw new Error('Decryption returned no file URL');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Decryption failed';
      console.error(`🔐📱 ❌ Lazy decryption failed: ${attachment.fileName}`, error);

      // Update state with error
      updateDecryptionState(fileKey, {
        isLoading: false,
        error: errorMessage
      });

      return null;
    }
  }, [currentUser?.id, getDecryptionState, updateDecryptionState]);

  const isLoading = useCallback((fileUrl: string): boolean => {
    return getDecryptionState(fileUrl).isLoading;
  }, [getDecryptionState]);

  const getError = useCallback((fileUrl: string): string | null => {
    return getDecryptionState(fileUrl).error;
  }, [getDecryptionState]);

  const getDecryptedUrl = useCallback((fileUrl: string): string | null => {
    return getDecryptionState(fileUrl).decryptedUrl;
  }, [getDecryptionState]);

  const clearCache = useCallback((fileUrl?: string) => {
    if (fileUrl) {
      setDecryptionStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileUrl);
        return newMap;
      });
    } else {
      setDecryptionStates(new Map());
    }
  }, []);

  const getStats = useCallback(() => {
    const stats = {
      totalFiles: decryptionStates.size,
      decrypted: 0,
      loading: 0,
      errors: 0
    };

    decryptionStates.forEach((state) => {
      if (state.decryptedUrl) stats.decrypted++;
      if (state.isLoading) stats.loading++;
      if (state.error) stats.errors++;
    });

    return stats;
  }, [decryptionStates]);

  return {
    decryptFile,
    isLoading,
    getError,
    getDecryptedUrl,
    clearCache,
    getStats
  };
};