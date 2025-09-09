import { EncryptedAttachmentData } from "../types/cryptoAttachmentTypes";
import { DecryptedAttachment } from "../types/cryptoAttachmentTypes";
import { FileEncryptionService } from "./FileEncryptionService";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";



export class AttachmentDecryptionService {
  private static instance: AttachmentDecryptionService;

  private constructor() {}

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

    try {
      const decryptedBuffer = await this.decryptFile(
        encryptedAttachment.keyInfo,
        encryptedAttachment.iv,
        currentUserId,
        encryptedAttachment.version || 1,
        encryptedAttachment.encryptedFileUrl
      );

      if (decryptedBuffer) {
        const decryptedFileUrl = this.createDecryptedFileUrl(
          decryptedBuffer,
          encryptedAttachment.fileName,
          encryptedAttachment.fileType
        );

        return {
          fileUrl: decryptedFileUrl,
          fileType: encryptedAttachment.fileType,
          fileName: encryptedAttachment.fileName,
          fileSize: encryptedAttachment.fileSize,
          isEncrypted: true
        };
      }
    } catch (error) {
      console.error(`Failed to decrypt attachment ${encryptedAttachment.fileName}:`, error);
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
      const userKeys = cryptoService.getCachedKeys(userId); // ✅ Direkte kall
      
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
   * Create download URL for decrypted file
   */
  private createDecryptedFileUrl(decryptedBuffer: ArrayBuffer, fileName: string, mimeType: string): string {
    // React Native støtter ikke Blob med ArrayBuffer - bruk base64 data URI i stedet
    const bytes = new Uint8Array(decryptedBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return `data:${mimeType};base64,${base64}`;
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
}


