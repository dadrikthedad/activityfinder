// features/cryptoAttachments/hooks/useLazyFileDecryption.ts - Med AttachmentCacheService
import { useState, useCallback, useRef } from 'react';
import { AttachmentDecryptionService } from '@/features/cryptoAttachments/services/AttachmentDecryptionService';
import { AttachmentCacheService } from '@/features/crypto/cache/AttachmentCacheService';
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
  const cacheService = useRef(AttachmentCacheService.getInstance());

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

    // Return cached result if available in state
    if (currentState.decryptedUrl) {
      console.log(`🔐📱 ♻️ Using cached decryption from state: ${attachment.fileName}`);
      return currentState.decryptedUrl;
    }

    // Skip if already loading
    if (currentState.isLoading) {
      console.log(`🔐📱 ⏳ Decryption already in progress: ${attachment.fileName}`);
      return null;
    }

    // FIRST: Check AttachmentCacheService
    console.log(`🔐📱 🔍 Checking cache for: ${attachment.fileName}`);
    try {
      const cachedPath = await cacheService.current.getCachedAttachment(attachment.fileUrl);
      if (cachedPath) {
        console.log(`🔐📱 🚀 Using cached attachment: ${attachment.fileName}`);
        
        // Update state with cached result
        updateDecryptionState(fileKey, {
          isLoading: false,
          decryptedUrl: cachedPath,
          error: null
        });
        
        return cachedPath;
      }
    } catch (error) {
      console.warn('Failed to check attachment cache:', error);
    }

    // If not cached, proceed with decryption
    console.log(`🔐📱 💾 No cache found, starting decryption: ${attachment.fileName}`);
    console.log(`🔐📱 🔄 Starting lazy decryption: ${attachment.fileName}`);

    // Set loading state
    updateDecryptionState(fileKey, {
      isLoading: true,
      error: null
    });

    try {
      // Create EncryptedAttachmentData from AttachmentDto
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

        // CACHE THE DECRYPTED FILE
        // Vi må lese den dekrypterte filen og cache den
        try {
          // result.fileUrl peker til en midlertidig fil som AttachmentDecryptionService lagde
          // Vi trenger å lese denne og cache den via AttachmentCacheService
          
          const response = await fetch(result.fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to read decrypted file: ${response.status}`);
          }
          
          const buffer = await response.arrayBuffer();
          
          // Cache den dekrypterte filen
          const cachedPath = await cacheService.current.cacheAttachment(
            attachment.fileUrl,
            buffer,
            attachment.fileName || 'unknown'
          );
          
          // Bruk cached path hvis tilgjengelig, ellers fallback til original result
          const finalPath = cachedPath || result.fileUrl;
          
          console.log(`🔐📱 📦 Cached decrypted file: ${attachment.fileName} -> ${finalPath.split('/').pop()}`);
          
          // Update state with success
          updateDecryptionState(fileKey, {
            isLoading: false,
            decryptedUrl: finalPath,
            error: null
          });

          return finalPath;
          
        } catch (cacheError) {
          console.warn('Failed to cache decrypted file, using original result:', cacheError);
          
          // Fallback til original result selv om caching feilet
          updateDecryptionState(fileKey, {
            isLoading: false,
            decryptedUrl: result.fileUrl,
            error: null
          });

          return result.fileUrl;
        }
        
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

  const clearCache = useCallback(async (fileUrl?: string) => {
    if (fileUrl) {
      setDecryptionStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileUrl);
        return newMap;
      });
    } else {
      setDecryptionStates(new Map());
      // Også clear AttachmentCacheService
      try {
        await cacheService.current.clearCache();
        console.log('🔐📱 🧹 All decryption and attachment caches cleared');
      } catch (error) {
        console.warn('Failed to clear attachment cache:', error);
      }
    }
  }, []);

  const getStats = useCallback(() => {
    const decryptionStats = {
      totalFiles: decryptionStates.size,
      decrypted: 0,
      loading: 0,
      errors: 0
    };

    decryptionStates.forEach((state) => {
      if (state.decryptedUrl) decryptionStats.decrypted++;
      if (state.isLoading) decryptionStats.loading++;
      if (state.error) decryptionStats.errors++;
    });

    const cacheStats = cacheService.current.getCacheStats();

    return {
      decryption: decryptionStats,
      cache: cacheStats
    };
  }, [decryptionStates]);

  // Utility function til å initialisere cache ved app start
  const initializeCache = useCallback(async () => {
    try {
      await cacheService.current.initializeCache();
    } catch (error) {
      console.warn('Failed to initialize attachment cache:', error);
    }
  }, []);

  return {
    decryptFile,
    isLoading,
    getError,
    getDecryptedUrl,
    clearCache,
    getStats,
    initializeCache
  };
};