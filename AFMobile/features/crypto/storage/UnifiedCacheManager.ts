// features/crypto/storage/UnifiedCacheManager.ts
import { AttachmentCacheService } from './AttachmentCacheService';
import { ThumbnailCacheService } from '@/features/cryptoAttachments/services/ThumbnailCacheService';
import { TempFileService } from './TempFileService';
import { conversationKeysCache, ConversationKeysCache } from './ConversationKeyCache';
import { cleanupManager, CleanupManager, StorageHealth } from '../../cleanup/CleanupManager';

export enum FileType {
  IMAGE = 'image',
  THUMBNAIL = 'thumbnail', 
  VIDEO = 'video',
  LARGE_FILE = 'large_file',
  DOCUMENT = 'document',
  CONVERSATION_KEYS = 'conversation_keys'
}

export interface FileStorageDecision {
  shouldUseCache: boolean;
  shouldUseTemp: boolean;
  fileType: FileType;
  reason: string;
}

export interface StorageStats {
  cache: {
    attachments: ReturnType<AttachmentCacheService['getCacheStats']>;
    thumbnails: ReturnType<ThumbnailCacheService['getCacheStats']>;
  };
  temp: ReturnType<TempFileService['getTempStorageStats']>;
  conversationKeys: ReturnType<ConversationKeysCache['getStats']>;
  totalCacheSize: number;
  totalTempSize: number;
  health: StorageHealth;
}

export class UnifiedCacheManager {
  private static instance: UnifiedCacheManager;
  
  // Storage thresholds
  private readonly IMAGE_CACHE_THRESHOLD = 5 * 1024 * 1024; // 5MB - bilder under dette i cache
  private readonly VIDEO_TEMP_THRESHOLD = 50 * 1024 * 1024; // 50MB - videoer over dette i temp
  
  // Service instances
  private attachmentCache: AttachmentCacheService;
  private thumbnailCache: ThumbnailCacheService;
  private tempFileService: TempFileService;
  private conversationKeysCache: ConversationKeysCache;
  private cleanupManager: CleanupManager;

  private constructor() {
    this.attachmentCache = AttachmentCacheService.getInstance();
    this.thumbnailCache = ThumbnailCacheService.getInstance();
    this.tempFileService = TempFileService.getInstance();
    this.conversationKeysCache = conversationKeysCache;
    this.cleanupManager = cleanupManager;
  }

  public static getInstance(): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager();
    }
    return UnifiedCacheManager.instance;
  }

  /**
   * Bestem hvor fil skal lagres basert på type og størrelse
   */
  determineStorageStrategy(
    fileSize: number, 
    mimeType: string, 
    isOptimistic: boolean = false,
    isThumbnail: boolean = false
  ): FileStorageDecision {
    if (isThumbnail) {
      return {
        shouldUseCache: false,
        shouldUseTemp: true,
        fileType: FileType.THUMBNAIL,
        reason: 'Thumbnails lagres i temp storage, metadata caches i ThumbnailCacheService'
      };
    }

    // Bilder
    if (mimeType.startsWith('image/')) {
      if (fileSize <= this.IMAGE_CACHE_THRESHOLD) {
        return {
          shouldUseCache: true,
          shouldUseTemp: false,
          fileType: FileType.IMAGE,
          reason: `Bilde under ${this.IMAGE_CACHE_THRESHOLD / 1024 / 1024}MB lagres i cache`
        };
      } else {
        return {
          shouldUseCache: false,
          shouldUseTemp: true,
          fileType: FileType.IMAGE,
          reason: `Stort bilde over ${this.IMAGE_CACHE_THRESHOLD / 1024 / 1024}MB lagres i temp`
        };
      }
    }

    // Videoer
    if (mimeType.startsWith('video/')) {
      return {
        shouldUseCache: false,
        shouldUseTemp: true,
        fileType: FileType.VIDEO,
        reason: 'Videoer lagres alltid i temp på grunn av størrelse'
      };
    }

    // Store filer
    if (fileSize > this.VIDEO_TEMP_THRESHOLD) {
      return {
        shouldUseCache: false,
        shouldUseTemp: true,
        fileType: FileType.LARGE_FILE,
        reason: `Store filer over ${this.VIDEO_TEMP_THRESHOLD / 1024 / 1024}MB lagres i temp`
      };
    }

    // Dokumenter og andre filer
    return {
      shouldUseCache: true,
      shouldUseTemp: false,
      fileType: FileType.DOCUMENT,
      reason: 'Dokumenter lagres i cache for rask tilgang'
    };
  }

  /**
   * Lagre fil basert på optimal strategi
   */
  async storeFile(
    identifier: string,
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    isThumbnail: boolean = false
  ): Promise<string | null> {
    const strategy = this.determineStorageStrategy(
      buffer.byteLength, 
      mimeType, 
      false, 
      isThumbnail
    );

    console.log(`📁 Storing ${fileName}: ${strategy.reason}`);

    // Sjekk storage health før lagring
    await this.cleanupManager.ensureStorageHealth(buffer.byteLength, strategy.shouldUseCache);

    try {
      if (strategy.shouldUseCache && !isThumbnail) {
        // Vanlige filer som skal i attachment cache
        return await this.attachmentCache.cacheAttachment(identifier, buffer, fileName);
      } else {
        // Thumbnails og store filer går til temp storage
        return await this.tempFileService.saveToTemp(identifier, buffer, fileName, isThumbnail);
      }
    } catch (error) {
      console.error(`📁 Failed to store file ${fileName}:`, error);
      
      // Fallback strategy - alltid prøv temp storage
      console.log(`📁 Fallback: Trying temp storage for ${fileName}`);
      return await this.tempFileService.saveToTemp(identifier, buffer, fileName, isThumbnail);
    }
  }

  /**
   * Hent fil fra riktig storage
   */
  async getFile(identifier: string, mimeType?: string, isThumbnail: boolean = false): Promise<string | null> {
    // Prøv cache først for bilder og dokumenter
    if (!isThumbnail && mimeType && !mimeType.startsWith('video/')) {
      const cached = await this.attachmentCache.getCachedAttachment(identifier);
      if (cached) {
        console.log(`📁 Found ${identifier} in attachment cache`);
        return cached;
      }
    }

    // Prøv temp storage
    const tempPath = await this.tempFileService.getTempFile(identifier);
    if (tempPath) {
      console.log(`📁 Found ${identifier} in temp storage`);
      return tempPath;
    }

    console.log(`📁 File ${identifier} not found in any storage`);
    return null;
  }

  /**
   * Cache thumbnail
   */
  cacheThumbnail(
    fileUri: string, 
    fileSize: number | undefined, 
    thumbnailUri: string, 
    width: number, 
    height: number
  ): void {
    this.thumbnailCache.cacheThumbnail(fileUri, fileSize, thumbnailUri, width, height);
  }

  /**
   * Hent cached thumbnail
   */
  getCachedThumbnail(fileUri: string, fileSize?: number) {
    return this.thumbnailCache.getCachedThumbnail(fileUri, fileSize);
  }

  /**
   * Få komplett storage statistikk
   */
  async getStorageStats(): Promise<StorageStats> {
    const attachmentStats = this.attachmentCache.getCacheStats();
    const thumbnailStats = this.thumbnailCache.getCacheStats();
    const tempStats = this.tempFileService.getTempStorageStats();
    const keyStats = this.conversationKeysCache.getStats();
    const health = await this.cleanupManager.analyzeStorageHealth();

    return {
      cache: {
        attachments: attachmentStats,
        thumbnails: thumbnailStats
      },
      temp: tempStats,
      conversationKeys: keyStats,
      totalCacheSize: attachmentStats.totalSize,
      totalTempSize: tempStats.totalSize,
      health
    };
  }

  /**
   * Utfør vedlikehold av alle caches
   */
  async performMaintenance(): Promise<void> {
    return await this.cleanupManager.performMaintenance();
  }

  /**
   * Tøm spesifikke cache typer
   */
  async clearCache(type: 'all' | 'attachments' | 'thumbnails' | 'temp' | 'keys'): Promise<void> {
    return await this.cleanupManager.clearCache(type);
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    await this.tempFileService.shutdown();
    this.cleanupManager.shutdown();
    console.log('📁 UnifiedCacheManager shut down');
  }
}

// Export singleton
export const unifiedCacheManager = UnifiedCacheManager.getInstance();