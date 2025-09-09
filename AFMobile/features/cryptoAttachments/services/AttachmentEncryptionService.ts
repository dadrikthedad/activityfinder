// utils/attachments/AttachmentEncryptionService.ts
import { Alert } from 'react-native';
import { getConversationKeys } from '@/services/crypto/cryptoService';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';
import { FileEncryptionService } from './FileEncryptionService';

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  uri: string;
}

export interface ProcessedFile {
  buffer: ArrayBuffer;
  metadata: FileMetadata;
}

export interface EncryptedFileResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
  encryptedFileData: string;
}

export interface EncryptionOptions {
  onProgress?: (progress: number) => void;
  onFileProgress?: (fileIndex: number, totalFiles: number, fileName: string) => void;
}

export class AttachmentEncryptionService {
  private static instance: AttachmentEncryptionService;

  private constructor() {}

  public static getInstance(): AttachmentEncryptionService {
    if (!AttachmentEncryptionService.instance) {
      AttachmentEncryptionService.instance = new AttachmentEncryptionService();
    }
    return AttachmentEncryptionService.instance;
  }

  /**
   * Encrypt multiple files for a conversation
   */
  async encryptFiles(
    processedFiles: ProcessedFile[],
    conversationId: number,
    options?: EncryptionOptions
  ): Promise<EncryptedFileResult[]> {
    if (!processedFiles || processedFiles.length === 0) {
      throw new Error('No files provided for encryption');
    }

    console.log(`🔐 Starting attachment encryption for ${processedFiles.length} files`);
    
    const encryptedResults: EncryptedFileResult[] = [];
    
    for (let i = 0; i < processedFiles.length; i++) {
      const { buffer, metadata } = processedFiles[i];
      
      console.log(`🔐 Encrypting file ${i + 1}/${processedFiles.length}: ${metadata.name}`);
      
      // Progress callback for current file
      options?.onFileProgress?.(i + 1, processedFiles.length, metadata.name);
      
      try {
        // Encrypt file using E2EE service
        const encryptedFile = await this.encryptFile(buffer, conversationId);
        
        if (!encryptedFile) {
          throw new Error(`Failed to encrypt file ${metadata.name}`);
        }

        // Structure result for backend
        const encryptedResult: EncryptedFileResult = {
          fileName: metadata.name,
          fileType: metadata.type,
          fileSize: metadata.size,
          keyInfo: encryptedFile.keyInfo,
          iv: encryptedFile.iv,
          version: encryptedFile.version,
          encryptedFileData: encryptedFile.encryptedData
        };

        encryptedResults.push(encryptedResult);
        
        // Update overall progress
        const progressPercent = Math.round((i + 1) / processedFiles.length * 100);
        options?.onProgress?.(progressPercent);
        
        console.log(`🔐 ✅ Successfully encrypted file ${i + 1}/${processedFiles.length}: ${metadata.name}`);
        
      } catch (error) {
        console.error(`🔐 ❌ Failed to encrypt file ${metadata.name}:`, error);
        throw new Error(`Failed to encrypt file ${metadata.name}: ${error}`);
      }
    }
    
    console.log(`🔐 ✅ All ${processedFiles.length} files encrypted successfully`);
    return encryptedResults;
  }

  /**
   * Encrypt a single file
   */
  async encryptSingleFile(
    processedFile: ProcessedFile,
    conversationId: number,
  ): Promise<EncryptedFileResult> {
    const results = await this.encryptFiles([processedFile], conversationId);
    return results[0];
  }

  /**
   * Validate file before encryption
   */
  validateFile(file: ProcessedFile): { isValid: boolean; error?: string } {
    const { buffer, metadata } = file;

    if (!buffer || buffer.byteLength === 0) {
      return { isValid: false, error: 'File buffer is empty' };
    }

    if (!metadata.name || metadata.name.trim() === '') {
      return { isValid: false, error: 'File name is required' };
    }

    if (!metadata.type) {
      return { isValid: false, error: 'File type is required' };
    }

    if (metadata.size <= 0) {
      return { isValid: false, error: 'Invalid file size' };
    }

    // Buffer size should match metadata size (approximately)
    const sizeDifference = Math.abs(buffer.byteLength - metadata.size);
    const tolerance = metadata.size * 0.1; // 10% tolerance

    if (sizeDifference > tolerance) {
      console.warn(`File size mismatch for ${metadata.name}: buffer=${buffer.byteLength}, metadata=${metadata.size}`);
    }

    return { isValid: true };
  }

  /**
   * Validate multiple files before encryption
   */
  validateFiles(files: ProcessedFile[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!files || files.length === 0) {
      return { isValid: false, errors: ['No files provided'] };
    }

    files.forEach((file, index) => {
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        errors.push(`File ${index + 1} (${file.metadata.name}): ${validation.error}`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Private method to encrypt file data - moved from useE2EE
   */
  private async encryptFile(
    fileData: ArrayBuffer,
    conversationId: number
  ): Promise<{ encryptedData: string; keyInfo: { [userId: string]: string }; iv: string; version: number } | null> {
    try {
      if (!fileData || fileData.byteLength === 0) {
        throw new Error('File data cannot be empty');
      }

      const conversationKeys = await getConversationKeys(conversationId);
      if (!conversationKeys || !conversationKeys.participantKeys?.length) {
        throw new Error('No participant keys available for file encryption');
      }

      const recipientKeys: { [userId: string]: string } = {};
      conversationKeys.participantKeys.forEach(key => {
        recipientKeys[key.userId.toString()] = key.publicKey;
      });

      console.log(`Encrypting file for ${Object.keys(recipientKeys).length} recipients`);
      
      const fileEncryptionService = FileEncryptionService.getInstance();
      const encrypted = await fileEncryptionService.encryptFile(fileData, recipientKeys);
      
      return {
        encryptedData: encrypted.encryptedData,
        keyInfo: encrypted.keyInfo,
        iv: encrypted.iv,
        version: encrypted.version
      };
    } catch (error) {
      console.error('Failed to encrypt file:', error);
      
      Alert.alert(
        'File Encryption Failed',
        'Could not encrypt your file. Please try again.',
        [{ text: 'OK' }]
      );
      
      return null;
    }
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(encryptedResults: EncryptedFileResult[]): {
    totalFiles: number;
    totalOriginalSize: number;
    totalEncryptedSize: number;
    compressionRatio: number;
    averageEncryptionOverhead: number;
  } {
    const totalFiles = encryptedResults.length;
    const totalOriginalSize = encryptedResults.reduce((sum, result) => sum + result.fileSize, 0);
    
    // Estimate encrypted size from base64 data
    const totalEncryptedSize = encryptedResults.reduce((sum, result) => {
      const base64Length = result.encryptedFileData.length;
      // Base64 adds ~33% overhead, plus encryption adds MAC bytes
      const estimatedBinarySize = (base64Length * 3) / 4;
      return sum + estimatedBinarySize;
    }, 0);

    const compressionRatio = totalOriginalSize > 0 ? totalEncryptedSize / totalOriginalSize : 1;
    const averageEncryptionOverhead = totalFiles > 0 ? (totalEncryptedSize - totalOriginalSize) / totalFiles : 0;

    return {
      totalFiles,
      totalOriginalSize,
      totalEncryptedSize,
      compressionRatio,
      averageEncryptionOverhead
    };
  }
}