import { EncryptedAttachmentData } from "../types/cryptoAttachmentTypes";
import { DecryptedAttachment } from "../types/cryptoAttachmentTypes";
import { FileEncryptionService } from "./FileEncryptionService";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";
import RNFS from 'react-native-fs';

export class AttachmentDecryptionService {
  private static instance: AttachmentDecryptionService;
  private tempFileCache = new Map<string, string>(); // Maps encrypted URLs to temp file paths
  private initialized = false;

  private constructor() {
    this.initializeTempStorage();
  }

  public static getInstance(): AttachmentDecryptionService {
    if (!AttachmentDecryptionService.instance) {
      AttachmentDecryptionService.instance = new AttachmentDecryptionService();
    }
    return AttachmentDecryptionService.instance;
  }

  /**
   * Initialize temp storage and cleanup old files
   */
  private async initializeTempStorage(): Promise<void> {
    if (this.initialized) return;

    try {
      const tempDir = `${RNFS.TemporaryDirectoryPath}/decrypted_attachments`;
      
      // Create temp directory if it doesn't exist
      const dirExists = await RNFS.exists(tempDir);
      if (!dirExists) {
        await RNFS.mkdir(tempDir);
        console.log('📁 Created temp directory for decrypted attachments');
      }

      // Clean up old temp files (older than 24 hours)
      await this.cleanupOldTempFiles();
      
      this.initialized = true;
      console.log('📁 AttachmentDecryptionService temp storage initialized');
    } catch (error) {
      console.error('📁 Failed to initialize temp storage:', error);
    }
  }

  /**
   * Clean up old temporary files
   */
  private async cleanupOldTempFiles(): Promise<void> {
    try {
      const tempDir = `${RNFS.TemporaryDirectoryPath}/decrypted_attachments`;
      const files = await RNFS.readDir(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      let cleanedCount = 0;
      for (const file of files) {
        // Handle undefined mtime
        if (!file.mtime) {
          console.warn(`File ${file.name} has no mtime, skipping`);
          continue;
        }
        
        const fileAge = now - new Date(file.mtime).getTime();
        if (fileAge > maxAge) {
          await RNFS.unlink(file.path);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`📁 Cleaned up ${cleanedCount} old temp files`);
      }
    } catch (error) {
      console.error('📁 Failed to cleanup old temp files:', error);
    }
  }

  /**
   * Decrypt a single attachment
   */
  async decryptAttachment(
    encryptedAttachment: EncryptedAttachmentData,
    currentUserId: number
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

    // Check if file is already cached as temp file
    const cachedTempPath = this.tempFileCache.get(encryptedAttachment.encryptedFileUrl);
    // Legg til cleanup ved cache miss:
    if (cachedTempPath && !(await RNFS.exists(cachedTempPath))) {
      this.tempFileCache.delete(encryptedAttachment.encryptedFileUrl);
    }

    if (cachedTempPath && await RNFS.exists(cachedTempPath)) {
      console.log(`📁 Using cached temp file: ${encryptedAttachment.fileName}`);
      return {
        fileUrl: `file://${cachedTempPath}`,
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
        const isThumbnail = this.isThumbnailFile(encryptedAttachment);

        const tempFilePath = await this.saveToTempFile(
          decryptedBuffer,
          encryptedAttachment.fileName,
          encryptedAttachment.fileType,
          isThumbnail
        );

        if (tempFilePath) {
          // Cache the temp file path
          this.tempFileCache.set(encryptedAttachment.encryptedFileUrl, tempFilePath);

          return {
            fileUrl: `file://${tempFilePath}`,
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
   * Save decrypted buffer to temporary file
   */
  private async saveToTempFile(
    decryptedBuffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    isThumbnail: boolean = false  // Legg til parameter
  ): Promise<string | null> {
    try {
      await this.initializeTempStorage();

      const tempDir = `${RNFS.TemporaryDirectoryPath}/decrypted_attachments`;
      const timestamp = Date.now();
      
      // Håndter thumbnail vs original file
      let finalFileName: string;
      if (isThumbnail) {
        const baseNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        // Sjekk om det allerede har thumbnail-prefiks
        const cleanBaseName = baseNameWithoutExt.replace(/^thumbnail_/, "");
        finalFileName = `thumbnail_${cleanBaseName}.jpg`;
      } else {
        finalFileName = fileName;
      }
      
      const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 100);
      const tempFileName = `${timestamp}_${sanitizedFileName}`;
      const tempFilePath = `${tempDir}/${tempFileName}`;

        // Convert ArrayBuffer to base64 for RNFS
        const base64Data = this.arrayBufferToBase64(decryptedBuffer);
        
        // Write file to temp directory
        await RNFS.writeFile(tempFilePath, base64Data, 'base64');
        
        console.log(`📁 Saved decrypted file to temp: ${tempFileName} (${(decryptedBuffer.byteLength / 1024).toFixed(1)}KB)`);
        
        return tempFilePath;
      } catch (error) {
        console.error(`📁 Failed to save temp file for ${fileName}:`, error);
        return null;
      }
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
   * Clear temp file cache and optionally delete files
   */
  public async clearTempCache(deleteFiles: boolean = false): Promise<void> {
    if (deleteFiles) {
      try {
        const tempDir = `${RNFS.TemporaryDirectoryPath}/decrypted_attachments`;
        const exists = await RNFS.exists(tempDir);
        if (exists) {
          await RNFS.unlink(tempDir);
          await RNFS.mkdir(tempDir);
        }
        console.log('📁 Cleared all temp files');
      } catch (error) {
        console.error('📁 Failed to clear temp files:', error);
      }
    }
    
    this.tempFileCache.clear();
    console.log('📁 Cleared temp file cache');
  }

  /**
   * Get temp cache statistics
   */
  public getTempCacheStats(): { cachedFiles: number; tempDir: string } {
    return {
      cachedFiles: this.tempFileCache.size,
      tempDir: `${RNFS.TemporaryDirectoryPath}/decrypted_attachments`
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
}