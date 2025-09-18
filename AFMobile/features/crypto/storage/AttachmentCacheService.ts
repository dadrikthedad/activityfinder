// features/cryptoAttachments/services/AttachmentCacheService.ts
import * as FileSystem from 'expo-file-system';

export interface CachedAttachment {
  localPath: string;
  fileName: string;
  fileSize: number;
  timestamp: number;
}

export class AttachmentCacheService {
  private static instance: AttachmentCacheService;
  private cache = new Map<string, CachedAttachment>();
  private maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 dager
  private maxCacheSize = 500 * 1024 * 1024; // 500MB total cache størrelse
  
  private constructor() {
    this.initializeCacheDirectory();
  }

  public static getInstance(): AttachmentCacheService {
    if (!AttachmentCacheService.instance) {
      AttachmentCacheService.instance = new AttachmentCacheService();
    }
    return AttachmentCacheService.instance;
  }

  private async initializeCacheDirectory(): Promise<void> {
    try {
      const cacheDir = this.getCacheDirectory();
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        console.log(`📦 Created attachment cache directory: ${cacheDir}`);
      }
    } catch (error) {
      console.error('Failed to initialize attachment cache directory:', error);
    }
  }

  private getCacheDirectory(): string {
    return `${FileSystem.cacheDirectory}decrypted_attachments/`;
  }

  /**
   * Generer cache-nøkkel fra attachment URL
   */
  private generateCacheKey(attachmentUrl: string): string {
    // Bruk URL som basis for cache key, men sanitize den
    const urlParts = attachmentUrl.split('/');
    const fileName = urlParts[urlParts.length - 1] || 'unknown';
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Generer lokal filpath for caching
   */
  private generateLocalPath(attachmentUrl: string, originalFileName: string): string {
    const cacheDir = this.getCacheDirectory();
    const timestamp = Date.now();
    const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${cacheDir}${timestamp}_${sanitizedFileName}`;
  }

  /**
   * Cache en dekryptert attachment
   */
  async cacheAttachment(
    attachmentUrl: string, 
    decryptedBuffer: ArrayBuffer, 
    originalFileName: string
  ): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(attachmentUrl);
      const localPath = this.generateLocalPath(attachmentUrl, originalFileName);
      
      // Sjekk om vi har plass i cache
      await this.ensureCacheSpace(decryptedBuffer.byteLength);
      
      // Konverter buffer til base64 og lagre
      const uint8Array = new Uint8Array(decryptedBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);
      
      await FileSystem.writeAsStringAsync(localPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Verifiser at filen ble skrevet
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('Failed to write cached file');
      }

      // Oppdater cache
      this.cache.set(cacheKey, {
        localPath,
        fileName: originalFileName,
        fileSize: decryptedBuffer.byteLength,
        timestamp: Date.now()
      });

      console.log(`📦 Cached attachment: ${originalFileName} (${Math.round(decryptedBuffer.byteLength / 1024)}KB) -> ${localPath.split('/').pop()}`);
      
      return localPath;

    } catch (error) {
      console.error('Failed to cache attachment:', error);
      return null;
    }
  }

  /**
   * Hent cached attachment hvis tilgjengelig
   */
  async getCachedAttachment(attachmentUrl: string): Promise<string | null> {
    const cacheKey = this.generateCacheKey(attachmentUrl);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // Sjekk om cache er utløpt
    if (Date.now() - cached.timestamp > this.maxCacheAge) {
      await this.removeCachedAttachment(cacheKey);
      return null;
    }

    // Sjekk om filen fortsatt eksisterer
    try {
      const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
      if (!fileInfo.exists) {
        console.log(`📦 Cached file missing, removing from cache: ${cached.fileName}`);
        this.cache.delete(cacheKey);
        return null;
      }

      console.log(`📦 Using cached attachment: ${cached.fileName} (${Math.round(cached.fileSize / 1024)}KB)`);
      return cached.localPath;

    } catch (error) {
      console.warn('Error checking cached attachment:', error);
      this.cache.delete(cacheKey);
      return null;
    }
  }

  /**
   * Sjekk om attachment er cached
   */
  async hasCachedAttachment(attachmentUrl: string): Promise<boolean> {
    const cachedPath = await this.getCachedAttachment(attachmentUrl);
    return cachedPath !== null;
  }

  /**
   * Fjern spesifik cached attachment
   */
  async removeCachedAttachment(cacheKey: string): Promise<void> {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      try {
        await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
        console.log(`📦 Removed cached attachment: ${cached.fileName}`);
      } catch (error) {
        console.warn('Failed to delete cached file:', error);
      }
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Sørg for at det er plass i cache
   */
  private async ensureCacheSpace(newFileSize: number): Promise<void> {
    const currentCacheSize = this.getCurrentCacheSize();
    
    if (currentCacheSize + newFileSize > this.maxCacheSize) {
      console.log(`📦 Cache full (${Math.round(currentCacheSize / 1024 / 1024)}MB), cleaning up...`);
      await this.cleanupOldestFiles(newFileSize);
    }
  }

  /**
   * Få total cache størrelse
   */
  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.fileSize;
    }
    return totalSize;
  }

  /**
   * Rydd opp gamle filer for å gjøre plass
   */
  private async cleanupOldestFiles(spaceNeeded: number): Promise<void> {
    // Sorter etter timestamp (eldste først)
    const sortedEntries = Array.from(this.cache.entries()).sort((a, b) => 
      a[1].timestamp - b[1].timestamp
    );

    let freedSpace = 0;
    let cleanedCount = 0;

    for (const [key, cached] of sortedEntries) {
      if (freedSpace >= spaceNeeded) {
        break;
      }

      try {
        await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
        this.cache.delete(key);
        freedSpace += cached.fileSize;
        cleanedCount++;
        console.log(`📦 Cleaned up old attachment: ${cached.fileName}`);
      } catch (error) {
        console.warn('Failed to cleanup cached file:', cached.localPath, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`📦 Cleaned up ${cleanedCount} old attachments, freed ${Math.round(freedSpace / 1024 / 1024)}MB`);
    }
  }

  /**
   * Rydd opp utløpt cache
   */
  async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;
    let freedSpace = 0;

    const expiredEntries = Array.from(this.cache.entries()).filter(([_, cached]) => 
      now - cached.timestamp > this.maxCacheAge
    );

    for (const [key, cached] of expiredEntries) {
      try {
        await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
        this.cache.delete(key);
        freedSpace += cached.fileSize;
        cleanedCount++;
      } catch (error) {
        console.warn('Failed to delete expired cached file:', cached.localPath, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`📦 Cleaned up ${cleanedCount} expired attachments, freed ${Math.round(freedSpace / 1024 / 1024)}MB`);
    }
  }

  /**
   * Tøm hele cachen
   */
  async clearCache(): Promise<void> {
    const size = this.cache.size;
    let freedSpace = 0;

    // Slett alle cached filer
    for (const cached of this.cache.values()) {
      try {
        await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
        freedSpace += cached.fileSize;
      } catch (error) {
        console.warn('Failed to delete cached file:', cached.localPath, error);
      }
    }

    this.cache.clear();
    console.log(`📦 Cleared ${size} cached attachments, freed ${Math.round(freedSpace / 1024 / 1024)}MB`);
  }

  /**
   * Få cache-statistikk
   */
  getCacheStats(): {
    totalFiles: number;
    totalSize: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    averageFileSize: number;
  } {
    let totalSize = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const cached of this.cache.values()) {
      totalSize += cached.fileSize;
      
      if (oldestTimestamp === null || cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
      }
      
      if (newestTimestamp === null || cached.timestamp > newestTimestamp) {
        newestTimestamp = cached.timestamp;
      }
    }

    return {
      totalFiles: this.cache.size,
      totalSize,
      oldestTimestamp,
      newestTimestamp,
      averageFileSize: this.cache.size > 0 ? totalSize / this.cache.size : 0
    };
  }

  /**
   * Initialiser cache ved app start
   */
  async initializeCache(): Promise<void> {
    try {
      await this.initializeCacheDirectory();
      await this.cleanupExpiredCache();
      
      const stats = this.getCacheStats();
      console.log(`📦 Attachment cache initialized: ${stats.totalFiles} files, ${Math.round(stats.totalSize / 1024 / 1024)}MB`);
    } catch (error) {
      console.error('Failed to initialize attachment cache:', error);
    }
  }
}