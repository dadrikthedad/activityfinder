// features/cryptoAttachments/services/TempFileService.ts
import RNFS from 'react-native-fs';
import { generateCacheKey } from './utils/cacheKeyUtils';

export interface TempFileOptions {
  maxAge?: number;          // Max alder i millisekunder
  maxStorageSize?: number;  // Max total størrelse i bytes
  cleanupInterval?: number; // Hvor ofte cleanup kjøres
}

export interface TempFileInfo {
  localPath: string;
  fileName: string;
  fileSize: number;
  timestamp: number;
  lastAccessed: number;
}

export class TempFileService {
  private static instance: TempFileService;
  private tempFileCache = new Map<string, TempFileInfo>();
  private initialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Konfigurerbare innstillinger
  private readonly MAX_AGE: number;
  private readonly MAX_STORAGE_SIZE: number; 
  private readonly CLEANUP_INTERVAL: number;
  private readonly TEMP_DIR: string;

  private constructor(options: TempFileOptions = {}) {
    // Standard verdier som kan overstyres
    this.MAX_AGE = options.maxAge || 7 * 24 * 60 * 60 * 1000; // 7 dager
    this.MAX_STORAGE_SIZE = options.maxStorageSize || 1024 * 1024 * 1024; // 1GB
    this.CLEANUP_INTERVAL = options.cleanupInterval || 24 * 60 * 60 * 1000; // 24 timer
    this.TEMP_DIR = `${RNFS.TemporaryDirectoryPath}/decrypted_attachments`;
    
    this.initializeService();
  }

  public static getInstance(options?: TempFileOptions): TempFileService {
    if (!TempFileService.instance) {
      TempFileService.instance = new TempFileService(options);
    }
    return TempFileService.instance;
  }

  /**
   * Initialiser service
   */
  private async initializeService(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureTempDirectory();
      await this.loadExistingFiles();
      await this.performCleanup();
      this.startPeriodicCleanup();
      
      this.initialized = true;
      console.log(`📁 TempFileService initialized: ${this.tempFileCache.size} existing files`);
    } catch (error) {
      console.error('📁 Failed to initialize TempFileService:', error);
    }
  }

  /**
   * Opprett temp directory
   */
  private async ensureTempDirectory(): Promise<void> {
    const dirExists = await RNFS.exists(this.TEMP_DIR);
    if (!dirExists) {
      await RNFS.mkdir(this.TEMP_DIR);
      console.log(`📁 Created temp directory: ${this.TEMP_DIR}`);
    }
  }

  /**
   * Last inn eksisterende filer ved oppstart
   */
  private async loadExistingFiles(): Promise<void> {
    try {
      const files = await RNFS.readDir(this.TEMP_DIR);
      
      for (const file of files) {
        if (file.isFile() && file.mtime) {
          // Generer cache key fra filnavn (fjern timestamp prefix)
          const fileName = file.name.replace(/^\d+_/, '');
          const cacheKey = generateCacheKey(fileName);
          
          this.tempFileCache.set(cacheKey, {
            localPath: file.path,
            fileName: fileName,
            fileSize: file.size,
            timestamp: new Date(file.mtime).getTime(),
            lastAccessed: new Date(file.mtime).getTime()
          });
        }
      }
      
      console.log(`📁 Loaded ${this.tempFileCache.size} existing temp files`);
    } catch (error) {
      console.warn('📁 Failed to load existing files:', error);
    }
  }

  /**
   * Lagre fil til temp storage
   */
  async saveToTemp(
    identifier: string, 
    buffer: ArrayBuffer, 
    originalFileName: string,
    isThumbnail: boolean = false
  ): Promise<string | null> {
    try {
      await this.ensureInitialized();
      
      // Sjekk om vi har plass
      await this.ensureStorageSpace(buffer.byteLength);
      
      // Generer filnavn og path
      const timestamp = Date.now();
      let finalFileName = originalFileName;
      
      if (isThumbnail && !originalFileName.toLowerCase().includes('thumb')) {
        const baseNameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
        finalFileName = `thumbnail_${baseNameWithoutExt}.jpg`;
      }
      
      const sanitizedFileName = finalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const tempFileName = `${timestamp}_${sanitizedFileName}`;
      const tempFilePath = `${this.TEMP_DIR}/${tempFileName}`;

      // Lagre fil
      const base64Data = this.arrayBufferToBase64(buffer);
      await RNFS.writeFile(tempFilePath, base64Data, 'base64');
      
      // Oppdater cache
      const cacheKey = generateCacheKey(identifier);
      this.tempFileCache.set(cacheKey, {
        localPath: tempFilePath,
        fileName: originalFileName,
        fileSize: buffer.byteLength,
        timestamp: Date.now(),
        lastAccessed: Date.now()
      });

      console.log(`📁 Saved to temp: ${originalFileName} (${(buffer.byteLength / 1024).toFixed(1)}KB) -> ${tempFileName}`);
      
      return tempFilePath;

    } catch (error) {
      console.error(`📁 Failed to save temp file for ${originalFileName}:`, error);
      return null;
    }
  }

  /**
   * Hent fil fra temp storage
   */
  async getTempFile(identifier: string): Promise<string | null> {
    await this.ensureInitialized();
    
    const cacheKey = generateCacheKey(identifier);
    const tempFile = this.tempFileCache.get(cacheKey);
    
    if (!tempFile) {
      return null;
    }

    // Sjekk om filen fortsatt eksisterer
    const exists = await RNFS.exists(tempFile.localPath);
    if (!exists) {
      console.log(`📁 Temp file missing, removing from cache: ${tempFile.fileName}`);
      this.tempFileCache.delete(cacheKey);
      return null;
    }

    // Oppdater last accessed
    tempFile.lastAccessed = Date.now();
    
    console.log(`📁 Using temp file: ${tempFile.fileName} (${(tempFile.fileSize / 1024).toFixed(1)}KB)`);
    return tempFile.localPath;
  }

  /**
   * Sjekk om fil finnes i temp storage
   */
  async hasTempFile(identifier: string): Promise<boolean> {
    const tempPath = await this.getTempFile(identifier);
    return tempPath !== null;
  }

  /**
   * Sørg for at det er plass til ny fil
   */
  private async ensureStorageSpace(newFileSize: number): Promise<void> {
    const currentSize = this.getCurrentStorageSize();
    
    if (currentSize + newFileSize > this.MAX_STORAGE_SIZE) {
      console.log(`📁 Storage full (${Math.round(currentSize / 1024 / 1024)}MB), cleaning up...`);
      await this.cleanupBySize(newFileSize);
    }
  }

  /**
   * Få total storage størrelse
   */
  private getCurrentStorageSize(): number {
    let totalSize = 0;
    for (const tempFile of this.tempFileCache.values()) {
      totalSize += tempFile.fileSize;
    }
    return totalSize;
  }

  /**
   * Cleanup basert på størrelse (fjern eldste filer først)
   */
  private async cleanupBySize(spaceNeeded: number): Promise<void> {
    // Sorter etter last accessed (eldste først)
    const sortedEntries = Array.from(this.tempFileCache.entries()).sort((a, b) => 
      a[1].lastAccessed - b[1].lastAccessed
    );

    let freedSpace = 0;
    let cleanedCount = 0;

    for (const [key, tempFile] of sortedEntries) {
      if (freedSpace >= spaceNeeded) break;

      try {
        await RNFS.unlink(tempFile.localPath);
        this.tempFileCache.delete(key);
        freedSpace += tempFile.fileSize;
        cleanedCount++;
      } catch (error) {
        console.warn(`📁 Failed to cleanup temp file: ${tempFile.localPath}`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`📁 Cleaned up ${cleanedCount} temp files, freed ${Math.round(freedSpace / 1024 / 1024)}MB`);
    }
  }

  /**
   * Periodisk cleanup av gamle filer
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;
    let freedSpace = 0;

    const expiredEntries = Array.from(this.tempFileCache.entries()).filter(([_, tempFile]) => 
      now - tempFile.timestamp > this.MAX_AGE
    );

    for (const [key, tempFile] of expiredEntries) {
      try {
        await RNFS.unlink(tempFile.localPath);
        this.tempFileCache.delete(key);
        freedSpace += tempFile.fileSize;
        cleanedCount++;
      } catch (error) {
        console.warn(`📁 Failed to delete expired temp file: ${tempFile.localPath}`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`📁 Cleaned up ${cleanedCount} expired temp files, freed ${Math.round(freedSpace / 1024 / 1024)}MB`);
    }
  }

  /**
   * Start periodisk cleanup
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch(error => {
        console.warn('📁 Periodic cleanup failed:', error);
      });
    }, this.CLEANUP_INTERVAL);

    console.log(`📁 Started periodic cleanup (every ${this.CLEANUP_INTERVAL / 1000 / 60 / 60} hours)`);
  }

  /**
   * Stopp service og cleanup
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    await this.performCleanup();
    console.log('📁 TempFileService shut down');
  }

  /**
   * Tøm all temp storage
   */
  async clearAllTempFiles(): Promise<void> {
    const size = this.tempFileCache.size;
    let freedSpace = 0;

    for (const tempFile of this.tempFileCache.values()) {
      try {
        await RNFS.unlink(tempFile.localPath);
        freedSpace += tempFile.fileSize;
      } catch (error) {
        console.warn(`📁 Failed to delete temp file: ${tempFile.localPath}`, error);
      }
    }

    this.tempFileCache.clear();
    console.log(`📁 Cleared ${size} temp files, freed ${Math.round(freedSpace / 1024 / 1024)}MB`);
  }

  /**
   * Få statistikk
   */
  getTempStorageStats(): {
    totalFiles: number;
    totalSize: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    maxAge: number;
    maxStorageSize: number;
    tempDirectory: string;
  } {
    let totalSize = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const tempFile of this.tempFileCache.values()) {
      totalSize += tempFile.fileSize;
      
      if (oldestTimestamp === null || tempFile.timestamp < oldestTimestamp) {
        oldestTimestamp = tempFile.timestamp;
      }
      
      if (newestTimestamp === null || tempFile.timestamp > newestTimestamp) {
        newestTimestamp = tempFile.timestamp;
      }
    }

    return {
      totalFiles: this.tempFileCache.size,
      totalSize,
      oldestTimestamp,
      newestTimestamp,
      maxAge: this.MAX_AGE,
      maxStorageSize: this.MAX_STORAGE_SIZE,
      tempDirectory: this.TEMP_DIR
    };
  }

  /**
   * Utility methods
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeService();
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
}