// features/crpto/storage/hooks/useUnifiedCache.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { unifiedCacheManager, FileType, StorageStats } from '../UnifiedCacheManager';
import { conversationKeysCache } from '../ConversationKeyCache';



export interface CacheOperationResult {
  success: boolean;
  filePath?: string;
  error?: string;
  fileType?: FileType;
  storageLocation?: 'cache' | 'temp';
}

export interface ThumbnailResult {
  uri: string;
  width: number;
  height: number;
  cached: boolean;
}

export interface UseUnifiedCacheReturn {
  // File operations
  storeFile: (
    identifier: string,
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    isThumbnail?: boolean
  ) => Promise<CacheOperationResult>;
  
  getFile: (
    identifier: string,
    mimeType?: string,
    isThumbnail?: boolean
  ) => Promise<string | null>;
  
  // Thumbnail operations
  cacheThumbnail: (
    fileUri: string,
    fileSize: number | undefined,
    thumbnailUri: string,
    width: number,
    height: number
  ) => void;
  
  getCachedThumbnail: (
    fileUri: string,
    fileSize?: number
  ) => ThumbnailResult | null;
  
  // Conversation keys
  getConversationKeys: (conversationId: number) => Promise<any>;
  invalidateConversationKeys: (conversationId: number) => void;
  preloadConversationKeys: (conversationId: number) => Promise<void>;
  
  // Storage management
  getStorageStats: () => Promise<StorageStats>;
  performMaintenance: () => Promise<void>;
  clearCache: (type: 'all' | 'attachments' | 'thumbnails' | 'temp' | 'keys') => Promise<void>;
  
  // State
  isLoading: boolean;
  lastError: string | null;
  storageStats: StorageStats | null;
}

export const useUnifiedCache = (): UseUnifiedCacheReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  
  // Keep track of active operations to prevent concurrent issues
  const activeOperations = useRef(new Set<string>());

  /**
   * Generic error handler
   */
  const handleError = useCallback((error: any, operation: string) => {
    const errorMessage = error?.message || `Failed to ${operation}`;
    setLastError(errorMessage);
    console.error(`📁 ${operation} error:`, error);
    return errorMessage;
  }, []);

  /**
   * Clear error after some time
   */
  useEffect(() => {
    if (lastError) {
      const timer = setTimeout(() => setLastError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastError]);

  /**
   * Store file with loading state and error handling
   */
  const storeFile = useCallback(async (
    identifier: string,
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    isThumbnail: boolean = false
  ): Promise<CacheOperationResult> => {
    // Prevent concurrent operations on same file
    const operationKey = `store_${identifier}_${isThumbnail}`;
    if (activeOperations.current.has(operationKey)) {
      return {
        success: false,
        error: 'Operation already in progress'
      };
    }

    activeOperations.current.add(operationKey);
    setIsLoading(true);
    setLastError(null);

    try {
      const strategy = unifiedCacheManager.determineStorageStrategy(
        buffer.byteLength,
        mimeType,
        false,
        isThumbnail
      );

      const filePath = await unifiedCacheManager.storeFile(
        identifier,
        buffer,
        fileName,
        mimeType,
        isThumbnail
      );

      if (filePath) {
        console.log(`📁 Successfully stored ${fileName} (${strategy.fileType})`);
        return {
          success: true,
          filePath,
          fileType: strategy.fileType,
          storageLocation: strategy.shouldUseCache ? 'cache' : 'temp'
        };
      } else {
        return {
          success: false,
          error: 'Failed to store file - no path returned'
        };
      }

    } catch (error) {
      const errorMessage = handleError(error, `store file ${fileName}`);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      activeOperations.current.delete(operationKey);
      setIsLoading(false);
    }
  }, [handleError]);

  /**
   * Get file from appropriate storage
   */
  const getFile = useCallback(async (
    identifier: string,
    mimeType?: string,
    isThumbnail: boolean = false
  ): Promise<string | null> => {
    setLastError(null);

    try {
      return await unifiedCacheManager.getFile(identifier, mimeType, isThumbnail);
    } catch (error) {
      handleError(error, `get file ${identifier}`);
      return null;
    }
  }, [handleError]);

  /**
   * Cache thumbnail
   */
  const cacheThumbnail = useCallback((
    fileUri: string,
    fileSize: number | undefined,
    thumbnailUri: string,
    width: number,
    height: number
  ) => {
    try {
      unifiedCacheManager.cacheThumbnail(fileUri, fileSize, thumbnailUri, width, height);
    } catch (error) {
      handleError(error, 'cache thumbnail');
    }
  }, [handleError]);

  /**
   * Get cached thumbnail
   */
  const getCachedThumbnail = useCallback((
    fileUri: string,
    fileSize?: number
  ): ThumbnailResult | null => {
    try {
      const cached = unifiedCacheManager.getCachedThumbnail(fileUri, fileSize);
      if (cached) {
        return {
          uri: cached.uri,
          width: cached.width,
          height: cached.height,
          cached: true
        };
      }
      return null;
    } catch (error) {
      handleError(error, 'get cached thumbnail');
      return null;
    }
  }, [handleError]);

  /**
   * Get conversation keys
   */
  const getConversationKeys = useCallback(async (conversationId: number) => {
    setLastError(null);
    
    try {
      return await conversationKeysCache.getKeys(conversationId);
    } catch (error) {
      handleError(error, `get conversation keys for ${conversationId}`);
      throw error; // Re-throw because this is critical
    }
  }, [handleError]);

  /**
   * Invalidate conversation keys
   */
  const invalidateConversationKeys = useCallback((conversationId: number) => {
    try {
      conversationKeysCache.invalidate(conversationId);
    } catch (error) {
      handleError(error, `invalidate conversation keys for ${conversationId}`);
    }
  }, [handleError]);

  /**
   * Preload conversation keys
   */
  const preloadConversationKeys = useCallback(async (conversationId: number) => {
    try {
      await conversationKeysCache.preload(conversationId);
    } catch (error) {
      handleError(error, `preload conversation keys for ${conversationId}`);
    }
  }, [handleError]);

  /**
   * Get storage statistics
   */
  const getStorageStats = useCallback(async (): Promise<StorageStats> => {
    try {
      const stats = await unifiedCacheManager.getStorageStats();
      setStorageStats(stats);
      return stats;
    } catch (error) {
      handleError(error, 'get storage stats');
      throw error;
    }
  }, [handleError]);

  /**
   * Perform maintenance
   */
  const performMaintenance = useCallback(async () => {
    setIsLoading(true);
    setLastError(null);

    try {
      await unifiedCacheManager.performMaintenance();
      // Refresh stats after maintenance
      await getStorageStats();
    } catch (error) {
      handleError(error, 'perform maintenance');
    } finally {
      setIsLoading(false);
    }
  }, [handleError, getStorageStats]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(async (
    type: 'all' | 'attachments' | 'thumbnails' | 'temp' | 'keys'
  ) => {
    setIsLoading(true);
    setLastError(null);

    try {
      await unifiedCacheManager.clearCache(type);
      // Refresh stats after clearing
      await getStorageStats();
    } catch (error) {
      handleError(error, `clear ${type} cache`);
    } finally {
      setIsLoading(false);
    }
  }, [handleError, getStorageStats]);

  /**
   * Load initial storage stats
   */
  useEffect(() => {
    getStorageStats().catch(console.error);
  }, [getStorageStats]);

  return {
    // File operations
    storeFile,
    getFile,
    
    // Thumbnail operations
    cacheThumbnail,
    getCachedThumbnail,
    
    // Conversation keys
    getConversationKeys,
    invalidateConversationKeys,
    preloadConversationKeys,
    
    // Storage management
    getStorageStats,
    performMaintenance,
    clearCache,
    
    // State
    isLoading,
    lastError,
    storageStats
  };
};