// features/cryptoAttachments/services/AttachmentEncryptionService.ts - Updated with thumbnail reuse support
import { Alert } from 'react-native';
import { getConversationKeys } from '@/services/crypto/cryptoService';
import { FileEncryptionService } from './FileEncryptionService';
import { ThumbnailService } from './ThumbnailService';

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  uri: string;
}

// Utvidet interface for å støtte pre-genererte thumbnails
export interface ProcessedFile {
  buffer: ArrayBuffer;
  metadata: FileMetadata;
  optimisticId?: string;
  thumbnail?: {
    buffer: ArrayBuffer;
    width: number;
    height: number;
    mimeType: string;
  };
}

export interface EncryptedFileResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
  encryptedFileData: string;
  optimisticId?: string;
  
  // Thumbnail data (nullable)
  thumbnailUrl?: string;
  thumbnailKeyInfo?: { [userId: string]: string };
  thumbnailIV?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  encryptedThumbnailData?: string;
}

export interface EncryptionOptions {
  onProgress?: (progress: number) => void;
  onFileProgress?: (fileIndex: number, totalFiles: number, fileName: string) => void;
  generateThumbnails?: boolean;
  thumbnailMaxSize?: number;
  thumbnailQuality?: number;
}

export class AttachmentEncryptionService {
  private static instance: AttachmentEncryptionService;
  private thumbnailService: ThumbnailService;

  private constructor() {
    this.thumbnailService = ThumbnailService.getInstance();
  }

  public static getInstance(): AttachmentEncryptionService {
    if (!AttachmentEncryptionService.instance) {
      AttachmentEncryptionService.instance = new AttachmentEncryptionService();
    }
    return AttachmentEncryptionService.instance;
  }

  /**
   * Encrypt multiple files for a conversation with thumbnail support (including pre-generated)
   */
  async encryptFiles(
    processedFiles: ProcessedFile[],
    conversationId: number,
    options: EncryptionOptions = {}
  ): Promise<EncryptedFileResult[]> {
    if (!processedFiles || processedFiles.length === 0) {
      throw new Error('No files provided for encryption');
    }

    const {
      generateThumbnails = true,
    } = options;

    console.log(`🔐 Starting attachment encryption for ${processedFiles.length} files (thumbnails: ${generateThumbnails})`);
    
    const encryptedResults: EncryptedFileResult[] = [];
    
    // Beregn faktiske steg basert på hvilke filer som trenger thumbnail-behandling
    const filesNeedingThumbnailGeneration = generateThumbnails 
      ? processedFiles.filter(f => 
          !f.thumbnail && // Ingen pre-generert thumbnail
          this.thumbnailService.supportsThumbnail(f.metadata.type)
        ).length 
      : 0;
    
    const filesWithExistingThumbnails = processedFiles.filter(f => f.thumbnail).length;
    
    const totalSteps = processedFiles.length * 2 + filesNeedingThumbnailGeneration; // encrypt original + encrypt thumbnail (hvis nødvendig)
    let currentStep = 0;
    
    console.log(`🔐 📊 Thumbnail status: ${filesWithExistingThumbnails} pre-generated, ${filesNeedingThumbnailGeneration} need generation`);
    
    for (let i = 0; i < processedFiles.length; i++) {
      const file = processedFiles[i];
      
      console.log(`🔐 Processing file ${i + 1}/${processedFiles.length}: ${file.metadata.name}`);
      
      options?.onFileProgress?.(i + 1, processedFiles.length, file.metadata.name);
      
      try {
        // Step 1: Handle thumbnail (use existing or generate new)
        let thumbnailData: {
          buffer: ArrayBuffer;
          width: number;
          height: number;
          mimeType: string;
        } | null = null;
        
        if (file.thumbnail) {
          // Use pre-generated thumbnail
          console.log(`🖼️ Using pre-generated thumbnail for ${file.metadata.name} (${file.thumbnail.width}x${file.thumbnail.height})`);
          thumbnailData = file.thumbnail;
        } else if (generateThumbnails && this.thumbnailService.supportsThumbnail(file.metadata.type)) {
          // Generate new thumbnail
          console.log(`🖼️ Generating new thumbnail for ${file.metadata.name}`);
          
          const processedFileWithThumbnail = await this.thumbnailService.processFileWithThumbnail(
            file.buffer,
            file.metadata,
          );
          
          if (processedFileWithThumbnail?.thumbnail) {
            thumbnailData = {
              ...processedFileWithThumbnail.thumbnail,
              mimeType: 'image/jpeg' // Standard for thumbnails
            };
          }
          
          currentStep++;
          options?.onProgress?.(Math.round((currentStep / totalSteps) * 100));
        }

        // Step 2: Encrypt original file
        console.log(`🔐 Encrypting original file: ${file.metadata.name}`);
        const encryptedOriginal = await this.encryptFile(file.buffer, conversationId);
        
        if (!encryptedOriginal) {
          throw new Error(`Failed to encrypt file ${file.metadata.name}`);
        }

        currentStep++;
        options?.onProgress?.(Math.round((currentStep / totalSteps) * 100));

        // Step 3: Encrypt thumbnail if available
        let encryptedThumbnail: {
          encryptedData: string;
          keyInfo: { [userId: string]: string };
          iv: string;
          version: number;
        } | null = null;

        if (thumbnailData) {
          const thumbnailSource = file.thumbnail ? 'pre-generated' : 'newly generated';
          console.log(`🔐 Encrypting ${thumbnailSource} thumbnail for: ${file.metadata.name}`);
          
          encryptedThumbnail = await this.encryptFile(
            thumbnailData.buffer,
            conversationId
          );

          if (!encryptedThumbnail) {
            console.warn(`Failed to encrypt thumbnail for ${file.metadata.name}, continuing without thumbnail`);
          }

          currentStep++;
          options?.onProgress?.(Math.round((currentStep / totalSteps) * 100));
        }

        // Structure result for backend
        const encryptedResult: EncryptedFileResult = {
          fileName: file.metadata.name,
          fileType: file.metadata.type,
          fileSize: file.metadata.size,
          keyInfo: encryptedOriginal.keyInfo,
          iv: encryptedOriginal.iv,
          version: encryptedOriginal.version,
          encryptedFileData: encryptedOriginal.encryptedData,
          optimisticId: file.optimisticId,
          
          // Add thumbnail data if available
          ...(encryptedThumbnail && thumbnailData && {
            thumbnailKeyInfo: encryptedThumbnail.keyInfo,
            thumbnailIV: encryptedThumbnail.iv,
            thumbnailWidth: thumbnailData.width,
            thumbnailHeight: thumbnailData.height,
            encryptedThumbnailData: encryptedThumbnail.encryptedData
          })
        };

        encryptedResults.push(encryptedResult);
        
        const thumbnailInfo = encryptedThumbnail ? 
          ` with ${thumbnailData!.width}x${thumbnailData!.height} thumbnail (${file.thumbnail ? 'pre-generated' : 'generated'})` : 
          '';
          
        console.log(`🔐 ✅ Successfully processed file ${i + 1}/${processedFiles.length}: ${file.metadata.name}${thumbnailInfo}`);
        
      } catch (error) {
        console.error(`🔐 ❌ Failed to process file ${file.metadata.name}:`, error);
        throw new Error(`Failed to process file ${file.metadata.name}: ${error}`);
      }
    }
    
    // Print summary
    const filesWithThumbnails = encryptedResults.filter(r => r.encryptedThumbnailData).length;
    const preGeneratedCount = processedFiles.filter(f => f.thumbnail).length;
    const newlyGeneratedCount = filesWithThumbnails - preGeneratedCount;
    
    console.log(`🔐 ✅ All ${processedFiles.length} files processed successfully (${filesWithThumbnails} with thumbnails: ${preGeneratedCount} reused, ${newlyGeneratedCount} generated)`);
    
    return encryptedResults;
  }

  /**
   * Encrypt a single file with thumbnail support
   */
  async encryptSingleFile(
    processedFile: ProcessedFile,
    conversationId: number,
    options: EncryptionOptions = {}
  ): Promise<EncryptedFileResult> {
    const results = await this.encryptFiles([processedFile], conversationId, options);
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

    // Validate thumbnail if present
    if (file.thumbnail) {
      if (!file.thumbnail.buffer || file.thumbnail.buffer.byteLength === 0) {
        return { isValid: false, error: 'Thumbnail buffer is empty' };
      }
      
      if (file.thumbnail.width <= 0 || file.thumbnail.height <= 0) {
        return { isValid: false, error: 'Invalid thumbnail dimensions' };
      }
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
   * Private method to encrypt file data
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

      console.log(`Encrypting data (${fileData.byteLength} bytes) for ${Object.keys(recipientKeys).length} recipients`);
      
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
   * Get encryption statistics including thumbnails
   */
  getEncryptionStats(encryptedResults: EncryptedFileResult[]): {
    totalFiles: number;
    filesWithThumbnails: number;
    totalOriginalSize: number;
    totalEncryptedSize: number;
    totalThumbnailSize: number;
    compressionRatio: number;
    averageEncryptionOverhead: number;
  } {
    const totalFiles = encryptedResults.length;
    const filesWithThumbnails = encryptedResults.filter(r => r.encryptedThumbnailData).length;
    const totalOriginalSize = encryptedResults.reduce((sum, result) => sum + result.fileSize, 0);
    
    // Estimate encrypted sizes from base64 data
    const totalEncryptedSize = encryptedResults.reduce((sum, result) => {
      const base64Length = result.encryptedFileData.length;
      const estimatedBinarySize = (base64Length * 3) / 4;
      return sum + estimatedBinarySize;
    }, 0);

    const totalThumbnailSize = encryptedResults.reduce((sum, result) => {
      if (result.encryptedThumbnailData) {
        const thumbnailBase64Length = result.encryptedThumbnailData.length;
        const estimatedThumbnailSize = (thumbnailBase64Length * 3) / 4;
        return sum + estimatedThumbnailSize;
      }
      return sum;
    }, 0);

    const compressionRatio = totalOriginalSize > 0 ? totalEncryptedSize / totalOriginalSize : 1;
    const averageEncryptionOverhead = totalFiles > 0 ? (totalEncryptedSize - totalOriginalSize) / totalFiles : 0;

    return {
      totalFiles,
      filesWithThumbnails,
      totalOriginalSize,
      totalEncryptedSize,
      totalThumbnailSize,
      compressionRatio,
      averageEncryptionOverhead
    };
  }
}