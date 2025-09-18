import { EncryptedAttachmentData } from "../types/cryptoAttachmentTypes";
import { DecryptedAttachment } from "../types/cryptoAttachmentTypes";
import { FileEncryptionService } from "./FileEncryptionService";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";
import { unifiedCacheManager } from "@/features/crypto/storage/UnifiedCacheManager";

export class AttachmentDecryptionService {
  private static instance: AttachmentDecryptionService;

  public static getInstance(): AttachmentDecryptionService {
    if (!AttachmentDecryptionService.instance) {
      AttachmentDecryptionService.instance = new AttachmentDecryptionService();
    }
    return AttachmentDecryptionService.instance;
  }

  /**
   * Decrypt a single attachment
   */
  async decryptAttachment(
    encryptedAttachment: EncryptedAttachmentData,
    currentUserId: number,
  ): Promise<DecryptedAttachment> {
    // If no encryption info, return as-is
    if (!encryptedAttachment.keyInfo) {
      return {
        fileUrl: encryptedAttachment.encryptedFileUrl,
        fileType: encryptedAttachment.fileType,
        fileName: encryptedAttachment.fileName,
        fileSize: encryptedAttachment.fileSize,
        isEncrypted: false
      };
    }

    const isThumbnail = this.isThumbnailFile(encryptedAttachment);
    const identifier = encryptedAttachment.encryptedFileUrl;

    // Check if file is already cached using UnifiedCacheManager
    const cachedPath = await unifiedCacheManager.getFile(identifier, encryptedAttachment.fileType, isThumbnail);
    
    if (cachedPath) {
      console.log(`📁 Using cached decrypted file: ${encryptedAttachment.fileName}`);
      
      // If it's a thumbnail, also cache the metadata
      if (isThumbnail && encryptedAttachment.fileSize) {
        // Try to get dimensions from file if available, otherwise use defaults
        const { width, height } = await this.getThumbnailDimensions(cachedPath);
        unifiedCacheManager.cacheThumbnail(
          encryptedAttachment.encryptedFileUrl,
          encryptedAttachment.fileSize,
          cachedPath,
          width,
          height
        );
      }

      return {
        fileUrl: `file://${cachedPath}`,
        fileType: encryptedAttachment.fileType,
        fileName: encryptedAttachment.fileName,
        fileSize: encryptedAttachment.fileSize,
        isEncrypted: true
      };
    }

    try {
      const decryptedBuffer = await this.decryptFile(
        encryptedAttachment.keyInfo,
        encryptedAttachment.iv,
        currentUserId,
        encryptedAttachment.version || 1,
        encryptedAttachment.encryptedFileUrl
      );

      if (decryptedBuffer) {
        // Store using UnifiedCacheManager
        const storedPath = await unifiedCacheManager.storeFile(
          identifier,
          decryptedBuffer,
          encryptedAttachment.fileName,
          encryptedAttachment.fileType,
          isThumbnail
        );

        if (storedPath) {
          // Cache thumbnail metadata if this is a thumbnail
          if (isThumbnail && encryptedAttachment.fileSize) {
            const { width, height } = await this.getThumbnailDimensions(storedPath);
            unifiedCacheManager.cacheThumbnail(
              encryptedAttachment.encryptedFileUrl,
              encryptedAttachment.fileSize,
              storedPath,
              width,
              height
            );
          }

          return {
            fileUrl: `file://${storedPath}`,
            fileType: encryptedAttachment.fileType,
            fileName: encryptedAttachment.fileName,
            fileSize: encryptedAttachment.fileSize,
            isEncrypted: true
          };
        }
      }
    } catch (error) {
      console.error(`📁 Failed to decrypt attachment ${encryptedAttachment.fileName}:`, error);
    }

    // Fallback: return encrypted file URL if decryption fails
    return {
      fileUrl: encryptedAttachment.encryptedFileUrl,
      fileType: encryptedAttachment.fileType,
      fileName: encryptedAttachment.fileName,
      fileSize: encryptedAttachment.fileSize,
      isEncrypted: true
    };
  }

  /**
   * Get thumbnail dimensions from file (placeholder implementation)
   */
  private async getThumbnailDimensions(filePath: string): Promise<{ width: number; height: number }> {
    // This would need to be implemented based on your image processing library
    // For now, return default dimensions
    return { width: 200, height: 200 };
  }

  /**
   * Decrypt multiple attachments
   */
  async decryptAttachments(
    encryptedAttachments: EncryptedAttachmentData[],
    currentUserId: number
  ): Promise<DecryptedAttachment[]> {
    return Promise.all(
      (encryptedAttachments || []).map(async (encAttachment) => {
        return this.decryptAttachment(encAttachment, currentUserId);
      })
    );
  }

  /**
   * Decrypt a file - moved from EncryptedAttachmentService
   */
  private async decryptFile(
    keyInfo: { [userId: string]: string },
    iv: string,
    userId: number,
    version: number = 1,
    encryptedFileUrl: string
  ): Promise<ArrayBuffer | null> {
    try {
      console.log(`🔐 Decrypting file with hybrid approach for user ${userId}`);

      // Step 1: Get user keys from CryptoService
      const cryptoService = CryptoService.getInstance();
      const userKeys = cryptoService.getCachedKeys(userId);
      
      if (!userKeys) {
        console.warn('🔐 No user keys available');
        return null;
      }

      // Step 2: Download the encrypted file
      console.log(`🔐 Downloading encrypted file from: ${encryptedFileUrl}`);
      const encryptedFileData = await this.downloadEncryptedFile(encryptedFileUrl);
      
      if (!encryptedFileData) {
        console.warn('🔐 Failed to download encrypted file');
        return null;
      }

      // Step 3: Create EncryptedFile object
      const encryptedFile = {
        encryptedData: this.arrayBufferToBase64(encryptedFileData),
        keyInfo,
        iv,
        version
      };

      // Step 4: Use FileEncryptionService for decryption
      const fileEncryptionService = FileEncryptionService.getInstance();
      const decryptedBuffer = await fileEncryptionService.decryptFile(
        encryptedFile, 
        userId, 
        userKeys
      );
      
      if (!decryptedBuffer) {
        console.warn('🔐 Failed to decrypt file');
        return null;
      }

      console.log('🔐 ✅ File decrypted successfully');
      return decryptedBuffer;
    } catch (error) {
      console.error('🔐 ❌ File decryption failed:', error);
      return null;
    }
  }

  /**
   * Helper method to download encrypted file
   */
  private async downloadEncryptedFile(fileUrl: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error('🔐 Failed to download encrypted file:', error);
      return null;
    }
  }

  /**
   * Utility method to convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Clear cache using UnifiedCacheManager
   */
  public async clearTempCache(deleteFiles: boolean = false): Promise<void> {
    if (deleteFiles) {
      // Clear all temp files through UnifiedCacheManager
      await unifiedCacheManager.clearCache('temp');
      console.log('📁 Cleared all temp files via UnifiedCacheManager');
    } else {
      console.log('📁 Cache clearing handled by UnifiedCacheManager');
    }
  }

  /**
   * Get cache statistics from UnifiedCacheManager
   */
  public async getTempCacheStats(): Promise<{
    cachedFiles: number;
    tempSize: number;
    cacheFiles: number;
    cacheSize: number;
    health: string;
  }> {
    const stats = await unifiedCacheManager.getStorageStats();
    
    return {
      cachedFiles: stats.temp.totalFiles,
      tempSize: stats.totalTempSize,
      cacheFiles: stats.cache.attachments.totalFiles,
      cacheSize: stats.totalCacheSize,
      health: stats.health.overall
    };
  }

  /**
   * Determine if this is a thumbnail based on various indicators
   */
  private isThumbnailFile(encryptedAttachment: EncryptedAttachmentData): boolean {
    // Check if URL contains thumbnail indicators
    const urlIndicators = [
      'thumbnails',
      'thumb_',
      'thumbnail'
    ];
    
    const hasUrlIndicator = urlIndicators.some(indicator => 
      encryptedAttachment.encryptedFileUrl?.toLowerCase().includes(indicator)
    );
    
    // Check if filename suggests thumbnail
    const filenameIndicators = [
      'thumb_',
      'thumbnail_'
    ];
    
    const hasFilenameIndicator = filenameIndicators.some(indicator =>
      encryptedAttachment.fileName?.toLowerCase().includes(indicator)
    );
    
    return hasUrlIndicator || hasFilenameIndicator;
  }

  /**
   * Preload conversation keys for faster decryption
   */
  public async preloadConversationKeys(conversationId: number): Promise<void> {
    // This would integrate with UnifiedCacheManager's conversation keys preloading
    // Implementation depends on how conversation keys relate to attachments
    console.log(`🔐 Preloading conversation keys for ${conversationId}`);
  }
}