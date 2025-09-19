// features/cryptoAttachments/Wiever/services/fileSystemService.ts
import * as FileSystem from 'expo-file-system';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { RNFile } from '@/utils/files/FileFunctions';
import { AttachmentCacheService } from '@/features/crypto/storage/AttachmentCacheService';
import { SmartDecryptionService } from '../../services/SmartDecryptionService';


export class FileSystemService {
  private static instance: FileSystemService;
  
  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  /**
   * Enhanced file system search
   */
  async searchForLocalFile(attachment: AttachmentDto): Promise<string | null> {
    console.log(`Searching for file by filename: ${attachment.fileName}`);
    
    // STEP 1: Check localUri first (optimistic messages)
    if (attachment.localUri) {
      console.log(`Checking localUri: ${attachment.localUri}`);
      try {
        const fileExists = await FileSystem.getInfoAsync(attachment.localUri);
        if (fileExists.exists) {
          console.log('Found via localUri:', attachment.fileName);
          return attachment.localUri;
        }
      } catch (error) {
        console.warn('LocalUri check failed:', error);
      }
    }

    // STEP 2: Search by exact filename in app directories
    console.log('Searching by filename in app directories...');
    return await this.searchInCriticalPaths(attachment);
  }

  private async searchInCriticalPaths(attachment: AttachmentDto): Promise<string | null> {
    const searchPaths = [
      // App-cache directories
      `${FileSystem.cacheDirectory}ImagePicker/`,
      `${FileSystem.cacheDirectory}decrypted_attachments/`,
      
      // Downloads and saved files
      `${FileSystem.documentDirectory}Downloads/`,
      `${FileSystem.documentDirectory}`,
      `${FileSystem.cacheDirectory}`,
      
      // Other possible locations
      `${FileSystem.documentDirectory}Pictures/`,
      `${FileSystem.documentDirectory}Media/`,
    ];

    for (const basePath of searchPaths) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(basePath);
        if (!dirInfo.exists) continue;

        const fullPath = `${basePath}${attachment.fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(fullPath);
        
        if (fileInfo.exists && !fileInfo.isDirectory) {
          console.log(`Found in path: ${fullPath}`);
          return fullPath;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Priority-based file URI resolution
   */
  async resolveFileUri(
    attachment: AttachmentDto, 
    originalFile: RNFile,
    cacheService: AttachmentCacheService,
    getDecryptedUrl: (url: string) => string | null,
    lazyDecryption: any,
    backgroundDecryption: any,
    smartDecryptionService: SmartDecryptionService
  ): Promise<RNFile> {
    if (!attachment?.needsDecryption) {
      return originalFile;
    }

    console.log(`Resolving URI for: ${attachment.fileName}`);
    
    // STEP 1: Search for local files (filename-based)
    console.log('Starting local file search...');
    try {
      const localPath = await this.searchForLocalFile(attachment);
      console.log('Local search result:', localPath);
      if (localPath) {
        console.log('Using local file:', attachment.fileName);
        return {
          ...originalFile,
          uri: localPath
        };
      }
    } catch (error) {
      console.error('Local search failed:', error);
    }

    // STEP 2: Check AttachmentCacheService  
    console.log(`Checking AttachmentCacheService for: ${attachment.fileUrl}`);
    try {
      const cachedPath = await cacheService.getCachedAttachment(attachment.fileUrl);
      console.log(`Cache result:`, cachedPath);
      if (cachedPath) {
        console.log('Using AttachmentCacheService:', attachment.fileName);
        return {
          ...originalFile,
          uri: cachedPath
        };
      }
    } catch (error) {
      console.warn('Failed to check attachment cache:', error);
    }

    // STEP 3: Check memory state from decryption store
    const existingDecryptedUrl = getDecryptedUrl(attachment.fileUrl);
    if (existingDecryptedUrl) {
      console.log('Using memory state:', attachment.fileName);
      return {
        ...originalFile,
        uri: existingDecryptedUrl
      };
    }

    // STEP 4: Decrypt using smart strategy
    console.log('Decrypting file with smart strategy:', attachment.fileName);
    const strategy = smartDecryptionService.getDecryptionStrategy(attachment);
    
    let decryptedUrl: string | null;
    if (strategy.immediate === 'lazy') {
      decryptedUrl = await lazyDecryption.decryptFile(attachment);
    } else {
      decryptedUrl = await backgroundDecryption.decryptFile(attachment);
    }
    
    if (decryptedUrl) {
      console.log('Decryption successful:', attachment.fileName);
      return {
        ...originalFile,
        uri: decryptedUrl
      };
    } else {
      const errorMsg = lazyDecryption.getError(attachment.fileUrl) || backgroundDecryption.getError(attachment.fileUrl) || 'Unknown decryption error';
      throw new Error(`Decryption failed: ${errorMsg}`);
    }
  }
}