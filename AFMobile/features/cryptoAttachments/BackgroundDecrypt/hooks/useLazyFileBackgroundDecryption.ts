// features/cryptoAttachments/hooks/useLazyFileBackgroundDecryption.ts
import { useCallback, useRef } from 'react';
import { BackgroundAttachmentDecryptionService } from '../BackgrundAttachmentDecryptionService';
import { unifiedCacheManager } from '@/features/crypto/storage/UnifiedCacheManager';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { useDecryptionStore } from '@/features/crypto/store/useDecryptionStore';
import { AttachmentDto } from '@shared/types/MessageDTO';
import * as FileSystem from 'expo-file-system';
import { generateCacheKey } from '@/features/crypto/storage/utils/cacheKeyUtils';


export const useLazyFileBackgroundDecryption = () => {
  const currentUser = useCurrentUser();
  const decryptionService = useRef(BackgroundAttachmentDecryptionService.getBackgroundInstance());
  
  // Use global store instead of local state
  const {
    startDecryption,
    updateProgress,
    completeDecryption,
    failDecryption,
    getDecryptedUrl,
    isDecrypting,
    getError,
    getProgress,
    getStatus,
    clearDecryptionState
  } = useDecryptionStore();

  const decryptFile = useCallback(async (
    attachment: AttachmentDto,
    options?: { skipCacheCheck?: boolean }
    ): Promise<string | null> => {
    if (!currentUser?.id) {
        console.error('🔐📱 No current user for lazy decryption');
        return null;
    }

    if (!attachment.needsDecryption) {
        return attachment.fileUrl;
    }

    const fileKey = generateCacheKey(attachment.fileUrl);
    const fileName = attachment.fileName || 'unknown';
    const isThumbnail = fileName.toLowerCase().includes('thumb');

    console.log(`🔐📱 Using cache key: ${fileKey} for file: ${fileName}`);

    // Return cached result if available in store
    const existingUrl = getDecryptedUrl(fileKey);
    if (existingUrl) {
        try {
        const fileInfo = await FileSystem.getInfoAsync(existingUrl);
        if (fileInfo.exists) {
            console.log(`🔐📱 ♻️ Using cached decryption from store: ${fileName}`);
            return existingUrl;
        } else {
            console.log(`🔐📱 ⚠️ Cached file no longer exists, re-decrypting: ${fileName}`);
            clearDecryptionState(fileKey);
        }
        } catch (error) {
        console.log(`🔐📱 ⚠️ Error checking cached file, re-decrypting: ${fileName}`);
        clearDecryptionState(fileKey);
        }
    }

    // Skip if already in progress
    const originalKey = attachment.fileUrl;
    if (isDecrypting(fileKey) || isDecrypting(originalKey)) {
        console.log(`🔐📱 ⏳ Decryption already in progress: ${fileName}`);
        return null;
    }

    try {
        // Start decryption with store tracking
        console.log(`🔐📱 🔄 Starting lazy decryption with UnifiedCacheManager: ${fileName}`);
        startDecryption(fileKey, fileName);

        // FIRST: Check UnifiedCacheManager for existing cached file (unless skipped)
        if (!options?.skipCacheCheck) {
        console.log(`🔐📱 🔍 Checking unified cache for: ${fileName}`);
        updateProgress(fileKey, 5, 'downloading');
        
        const cachedPath = await unifiedCacheManager.getFile(
            fileKey,
            attachment.fileType,
            isThumbnail
        );
        
        if (cachedPath) {
            console.log(`🔐📱 🚀 Using cached file from UnifiedCacheManager: ${fileName}`);
            completeDecryption(fileKey, cachedPath);
            return cachedPath;
        }
        } else {
        console.log(`🔐📱 ⏭️ Skipping cache check (already checked): ${fileName}`);
        updateProgress(fileKey, 5, 'downloading');
        }

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

      // Update progress for download phase
      updateProgress(fileKey, 10, 'downloading');
      updateProgress(fileKey, 25, 'decrypting');
      updateProgress(fileKey, 40, 'decrypting');

      // Use BackgroundAttachmentDecryptionService with progress callback
      const result = await decryptionService.current.decryptAttachment(
        encryptedAttachment,
        currentUser.id,
        (progress: number, message: string) => {
            // Map background progress (0-100) to our progress (40-90) - større range
            const mappedProgress = 40 + (progress * 0.5);
            updateProgress(fileKey, Math.round(mappedProgress), 'decrypting');
            }
      );

      if (result?.fileUrl) {
        console.log(`🔐📱 ✅ Lazy decryption completed: ${fileName}`);

        if (result.fileUrl === attachment.fileUrl) {
          throw new Error('Decryption returned same URL - decryption likely failed');
        }

        updateProgress(fileKey, 90, 'decrypting');

        // The file is already stored by AttachmentDecryptionService through UnifiedCacheManager
        // No need to manually cache again as it's handled internally
        
        console.log(`🔐📱 📦 File cached via UnifiedCacheManager: ${fileName}`);
        // Complete decryption in store
        completeDecryption(fileKey, result.fileUrl);
        
        return result.fileUrl;

      } else {
        throw new Error('Decryption returned no file URL');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Decryption failed';
      console.error(`🔐📱 ❌ Lazy decryption failed: ${fileName}`, error);

      // Update store with error
      failDecryption(fileKey, errorMessage);
      return null;
    }
  }, [currentUser?.id, startDecryption, updateProgress, completeDecryption, failDecryption, getDecryptedUrl, isDecrypting]);

  // Wrapper functions that use the store
  const isLoading = useCallback((fileUrl: string): boolean => {
    return isDecrypting(fileUrl);
  }, [isDecrypting]);

  const clearCache = useCallback(async (fileUrl?: string) => {
    if (fileUrl) {
      clearDecryptionState(fileUrl);
    } else {
      // Clear both store and UnifiedCacheManager
      useDecryptionStore.getState().clearAllDecryptionStates();
      try {
        await unifiedCacheManager.clearCache('all');
        console.log('🔐📱 🧹 All decryption and unified caches cleared');
      } catch (error) {
        console.warn('Failed to clear unified cache:', error);
      }
    }
  }, [clearDecryptionState]);

  const getStats = useCallback(async () => {
    const activeDecryptions = useDecryptionStore.getState().getActiveDecryptions();
    const totalProgress = useDecryptionStore.getState().getTotalProgress();
    const cacheStats = await unifiedCacheManager.getStorageStats();

    return {
      decryption: {
        totalFiles: useDecryptionStore.getState().decryptionStates.size,
        active: activeDecryptions.length,
        totalProgress: totalProgress
      },
      cache: {
        attachments: cacheStats.cache.attachments,
        temp: cacheStats.temp,
        thumbnails: cacheStats.cache.thumbnails,
        conversationKeys: cacheStats.conversationKeys,
        health: cacheStats.health
      }
    };
  }, []);

  // Utility function to initialize cache at app start
  const initializeCache = useCallback(async () => {
    try {
      // UnifiedCacheManager initializes automatically when first accessed
      const stats = await unifiedCacheManager.getStorageStats();
      console.log('🔐📱 📊 UnifiedCacheManager initialized:', {
        cacheFiles: stats.cache.attachments.totalFiles,
        tempFiles: stats.temp.totalFiles,
        health: stats.health.overall
      });
    } catch (error) {
      console.warn('Failed to initialize unified cache manager:', error);
    }
  }, []);

  // Get cached thumbnail for quick display
  const getCachedThumbnail = useCallback((fileUrl: string, fileSize?: number) => {
    return unifiedCacheManager.getCachedThumbnail(fileUrl, fileSize);
  }, []);

  // Preload conversation keys for faster decryption
  const preloadConversationKeys = useCallback(async (conversationId: number) => {
    try {
      // This would use the conversation keys cache from UnifiedCacheManager
      console.log(`🔐📱 🔑 Preloading conversation keys for ${conversationId}`);
      // Implementation depends on how you relate conversation IDs to file decryption
    } catch (error) {
      console.warn('Failed to preload conversation keys:', error);
    }
  }, []);

  return {
    // Core functions
    decryptFile,
    
    // Store-based getters
    getDecryptedUrl,
    isLoading,
    getError,
    getProgress,
    getStatus,
    
    // Additional utilities
    clearCache,
    getStats,
    initializeCache,
    getCachedThumbnail,
    preloadConversationKeys
  };
};