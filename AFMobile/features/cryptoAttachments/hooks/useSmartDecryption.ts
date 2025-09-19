// features/crypto/hooks/useSmartDecryption.ts
import { useCallback, useRef, useMemo } from 'react';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { SmartDecryptionService } from '../services/SmartDecryptionService';
import { useLazyFileDecryption } from '@/features/cryptoAttachments/hooks/useLazyFileDecryption';
import { useLazyFileBackgroundDecryption } from '../BackgroundDecrypt/useLazyFileBackgroundDecryption';

interface SmartDecryptionOptions {
  returnDetails?: boolean; // If true, returns strategy details
}

interface SmartDecryptionResult {
  success: boolean;
  fileUrl: string | null;
  strategy: 'lazy' | 'background';
  reason: string;
}

export const useSmartDecryption = () => {
  const smartService = useRef(SmartDecryptionService.getInstance());
  
  // Lazy initialization of hooks - only create when needed
  const lazyDecryption = useLazyFileDecryption();
  const backgroundDecryption = useLazyFileBackgroundDecryption();

  /**
   * Smart decryption that automatically chooses the best strategy
   * @param attachment - The attachment to decrypt
   * @param isUserRequested - True if user explicitly requested this decryption
   * @param options - Optional settings for return format
   */
  const decryptFile = useCallback(async (
    attachment: AttachmentDto,
    isUserRequested: boolean = false,
    options: SmartDecryptionOptions = {}
  ): Promise<string | null | SmartDecryptionResult> => {
    
    try {
      // Get optimal strategy from service
      const strategy = smartService.current.getDecryptionStrategy(attachment);
      
      console.log(`🧠 Smart decryption for ${attachment.fileName}: ${strategy.reason}`);
      
      let fileUrl: string | null = null;
      
      if (strategy.immediate === 'lazy') {
        // Use lazy decryption for small files/images
        console.log(`⚡ Using lazy decryption for ${attachment.fileName}`);
        fileUrl = await lazyDecryption.decryptFile(attachment);
        
      } else {
        // Use background decryption for large files/videos
        console.log(`🔄 Using background decryption for ${attachment.fileName}`);
        fileUrl = await backgroundDecryption.decryptFile(attachment);
      }
      
      // Return format based on options
      if (options.returnDetails) {
        return {
          success: !!fileUrl,
          fileUrl,
          strategy: strategy.immediate,
          reason: fileUrl ? strategy.reason : `${strategy.reason} - but decryption failed`
        };
      }
      
      if (fileUrl) {
        console.log(`✅ Smart decryption successful for ${attachment.fileName}`);
      } else {
        console.log(`❌ Smart decryption returned null for ${attachment.fileName}`);
      }
      
      return fileUrl;
      
    } catch (error) {
      console.error(`❌ Smart decryption failed for ${attachment.fileName}:`, error);
      
      if (options.returnDetails) {
        return {
          success: false,
          fileUrl: null,
          strategy: 'lazy', // Default fallback
          reason: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      
      return null;
    }
  }, [lazyDecryption, backgroundDecryption]);

  /**
   * Check if a file should be queued for background processing
   */
  const shouldQueueForBackground = useCallback((attachment: AttachmentDto): boolean => {
    const strategy = smartService.current.getDecryptionStrategy(attachment);
    return strategy.shouldQueue;
  }, []);

  /**
   * Get the recommended strategy without executing decryption
   */
  const getStrategy = useCallback((attachment: AttachmentDto) => {
    return smartService.current.getDecryptionStrategy(attachment);
  }, []);

  /**
   * Test decryption strategies for multiple files
   */
  const testStrategies = useCallback((attachments: AttachmentDto[]) => {
    return smartService.current.testStrategy(attachments);
  }, []);

  /**
   * Update configuration thresholds
   */
  const updateConfig = useCallback((newConfig: Parameters<typeof SmartDecryptionService.prototype.updateThresholds>[0]) => {
    smartService.current.updateThresholds(newConfig);
  }, []);

  /**
   * Get current configuration
   */
  const getConfig = useCallback(() => {
    return smartService.current.getConfig();
  }, []);

  // Direct access to specific decryption methods - consistent API
  const lazyDecryptFile = useCallback((attachment: AttachmentDto) => {
    return lazyDecryption.decryptFile(attachment);
  }, [lazyDecryption]);

  const backgroundDecryptFile = useCallback((attachment: AttachmentDto) => {
    return backgroundDecryption.decryptFile(attachment);
  }, [backgroundDecryption]);

  /**
   * Get details about decryption strategy with result
   */
  const decryptFileWithDetails = useCallback(async (
    attachment: AttachmentDto,
    isUserRequested: boolean = false
  ): Promise<SmartDecryptionResult> => {
    const result = await decryptFile(attachment, isUserRequested, { returnDetails: true });
    return result as SmartDecryptionResult;
  }, [decryptFile]);

  // Progress and state methods from underlying hooks
  const getDecryptedUrl = useCallback((fileUrl: string) => {
    // Try both hooks - they share the same store
    return lazyDecryption.getDecryptedUrl(fileUrl) || backgroundDecryption.getDecryptedUrl(fileUrl);
  }, [lazyDecryption, backgroundDecryption]);

  const isLoading = useCallback((fileUrl: string) => {
    return lazyDecryption.isLoading(fileUrl) || backgroundDecryption.isLoading(fileUrl);
  }, [lazyDecryption, backgroundDecryption]);

  const getProgress = useCallback((fileUrl: string) => {
    return lazyDecryption.getProgress(fileUrl) || backgroundDecryption.getProgress(fileUrl);
  }, [lazyDecryption, backgroundDecryption]);

  const getError = useCallback((fileUrl: string) => {
    return lazyDecryption.getError(fileUrl) || backgroundDecryption.getError(fileUrl);
  }, [lazyDecryption, backgroundDecryption]);

  const getStatus = useCallback((fileUrl: string) => {
    return lazyDecryption.getStatus(fileUrl) || backgroundDecryption.getStatus(fileUrl);
  }, [lazyDecryption, backgroundDecryption]);

  const clearCache = useCallback(async (fileUrl?: string) => {
    // Clear both caches
    await Promise.all([
      lazyDecryption.clearCache(fileUrl),
      backgroundDecryption.clearCache(fileUrl)
    ]);
  }, [lazyDecryption, backgroundDecryption]);

  const getStats = useCallback(async () => {
    const [lazyStats, backgroundStats] = await Promise.all([
      lazyDecryption.getStats(),
      backgroundDecryption.getStats()
    ]);

    return {
      lazy: lazyStats,
      background: backgroundStats,
      combined: {
        totalFiles: (lazyStats.decryption?.totalFiles || 0) + (backgroundStats.decryption?.totalFiles || 0),
        activeDecryptions: (lazyStats.decryption?.active || 0) + (backgroundStats.decryption?.active || 0),
      }
    };
  }, [lazyDecryption, backgroundDecryption]);

  return {
    // Primary smart decryption method - returns simple fileUrl or null for most cases
    decryptFile,
    
    // Get strategy details along with result
    decryptFileWithDetails,
    
    // Strategy helpers
    shouldQueueForBackground,
    getStrategy,
    testStrategies,
    updateConfig,
    getConfig,
    
    // Direct access to specific decryption methods (consistent API)
    lazyDecryptFile,
    backgroundDecryptFile,
    
    // State and progress methods (unified from both hooks)
    getDecryptedUrl,
    isLoading,
    getProgress,
    getError,
    getStatus,
    
    // Utility methods
    clearCache,
    getStats,
    
    // Advanced: access to underlying hooks if needed
    _lazyHook: lazyDecryption,
    _backgroundHook: backgroundDecryption
  };
};