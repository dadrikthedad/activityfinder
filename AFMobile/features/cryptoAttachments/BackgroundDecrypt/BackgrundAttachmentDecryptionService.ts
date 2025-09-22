// features/cryptoAttachments/BackgroundDecrypt/BackgroundAttachmentDecryptionService.ts
import { AttachmentDecryptionService } from '../services/AttachmentDecryptionService';
import BackgroundKotlinDecrypt from './Android/BackgroundKotlinDecrypt';
import { EncryptedAttachmentData, DecryptedAttachment } from '../types/cryptoAttachmentTypes';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';
import { unifiedCacheManager } from '@/features/crypto/storage/UnifiedCacheManager';
import { generateCacheKey } from '@/features/crypto/storage/utils/cacheKeyUtils';

export class BackgroundAttachmentDecryptionService {
  private static backgroundInstance: BackgroundAttachmentDecryptionService;
  private originalService: AttachmentDecryptionService;

  private constructor() {
    this.originalService = AttachmentDecryptionService.getInstance();
  }

  public static getBackgroundInstance(): BackgroundAttachmentDecryptionService {
    if (!BackgroundAttachmentDecryptionService.backgroundInstance) {
      BackgroundAttachmentDecryptionService.backgroundInstance = new BackgroundAttachmentDecryptionService();
    }
    return BackgroundAttachmentDecryptionService.backgroundInstance;
  }

  /**
   * Background decrypt attachment - uses the corrected hybrid approach WITH caching
   */
  async decryptAttachment(
    encryptedAttachment: EncryptedAttachmentData,
    currentUserId: number,
    onProgress?: (progress: number, message: string) => void
  ): Promise<DecryptedAttachment> {
    try {
      console.log(`🔐 BACKGROUND: Starting background decryption for ${encryptedAttachment.fileName}`);
      
      // Try background decryption first with progress tracking
      const backgroundResult = await this.performBackgroundDecryption(
        encryptedAttachment, 
        currentUserId,
        onProgress
      );
      
      if (backgroundResult) {
        return backgroundResult;
      }
      
      // Fallback to original service
      console.log(`🔐 BACKGROUND: Falling back to original service`);
      return await this.originalService.decryptAttachment(encryptedAttachment, currentUserId);
      
    } catch (error) {
      console.error('🔐 BACKGROUND: Error, falling back to original:', error);
      return await this.originalService.decryptAttachment(encryptedAttachment, currentUserId);
    }
  }

  private async performBackgroundDecryption(
    encryptedAttachment: EncryptedAttachmentData,
    currentUserId: number,
    onProgress?: (progress: number, message: string) => void
  ): Promise<DecryptedAttachment | null> {
    if (!encryptedAttachment.keyInfo) {
      return null;
    }

    try {
      if (onProgress) onProgress(10, "Getting user keys...");
      
      const cryptoService = CryptoService.getInstance();
      const userKeys = cryptoService.getCachedKeys(currentUserId);
      
      if (!userKeys) return null;

      if (onProgress) onProgress(20, "Downloading encrypted file...");
      
      const encryptedFileData = await this.downloadEncryptedFile(encryptedAttachment.encryptedFileUrl);
      if (!encryptedFileData) return null;

      const userKeyPackage = encryptedAttachment.keyInfo[currentUserId.toString()];
      if (!userKeyPackage) return null;

      if (onProgress) onProgress(30, "Starting background decryption...");

      // Use background decryption service
      const result = await BackgroundKotlinDecrypt.decryptAttachment(
        this.arrayBufferToBase64(encryptedFileData),
        userKeyPackage,
        encryptedAttachment.iv,
        this.arrayBufferToBase64(userKeys.secretKey),
        this.arrayBufferToBase64(userKeys.publicKey),
        (progress, message) => {
          if (onProgress) {
            // Map progress 30-90% for decryption phase
            const mappedProgress = 30 + (progress * 0.6);
            onProgress(Math.round(mappedProgress), message);
          }
        }
      );

      if (result.success) {
        if (onProgress) onProgress(92, "Storing decrypted file...");

        // CRITICAL FIX: Store the decrypted file using UnifiedCacheManager
        const decryptedBuffer = this.base64ToArrayBuffer(result.data);
        const cacheKey = generateCacheKey(encryptedAttachment.encryptedFileUrl);
        
        console.log(`🔐 BACKGROUND: Storing decrypted file via UnifiedCacheManager: ${encryptedAttachment.fileName}`);
        
        const storedPath = await unifiedCacheManager.storeFile(
          cacheKey,
          decryptedBuffer,
          encryptedAttachment.fileName,
          encryptedAttachment.fileType,
          false // not a thumbnail
        );

        if (storedPath) {
          if (onProgress) onProgress(100, "Background decryption complete!");

          console.log(`🔐 BACKGROUND: ✅ File stored at: ${storedPath}`);

          // RETT KODE: Bruk completeDecryption i stedet for setDecrypted
          const { useDecryptionStore } = await import('@/features/crypto/store/useDecryptionStore');
          const cacheKey = generateCacheKey(encryptedAttachment.encryptedFileUrl);
          
          // Marker filen som dekryptert i store
          useDecryptionStore.getState().completeDecryption(cacheKey, storedPath);
          console.log(`🔐 BACKGROUND: Updated Zustand store for ${encryptedAttachment.fileName}`);

          return {
            fileUrl: storedPath,
            fileType: encryptedAttachment.fileType,
            fileName: encryptedAttachment.fileName,
            fileSize: decryptedBuffer.byteLength,
            isEncrypted: true
          };
        } else {
          console.error(`🔐 BACKGROUND: Failed to store file: ${encryptedAttachment.fileName}`);
          // Fallback to data URI if storage fails
          return {
            fileUrl: `data:${encryptedAttachment.fileType};base64,${result.data}`,
            fileType: encryptedAttachment.fileType,
            fileName: encryptedAttachment.fileName,
            fileSize: this.calculateDecryptedSize(encryptedFileData.byteLength),
            isEncrypted: true
          };
        }
      }

      return null;

    } catch (error) {
      console.error('🔐 BACKGROUND: Background decryption failed:', error);
      return null;
    }
  }

  // Utility methods
  private async downloadEncryptedFile(fileUrl: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
      return await response.arrayBuffer();
    } catch (error) {
      console.error('Failed to download encrypted file:', error);
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private calculateDecryptedSize(encryptedSize: number): number {
    return Math.max(0, encryptedSize - 16);
  }
}