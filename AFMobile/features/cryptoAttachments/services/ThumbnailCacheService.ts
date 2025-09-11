// features/cryptoAttachments/services/ThumbnailCacheService.ts
export interface CachedThumbnail {
  uri: string;
  width: number;
  height: number;
  timestamp: number;
}

export class ThumbnailCacheService {
  private static instance: ThumbnailCacheService;
  private cache = new Map<string, CachedThumbnail>();
  private maxCacheAge = 24 * 60 * 60 * 1000; // 24 timer

  private constructor() {}

  public static getInstance(): ThumbnailCacheService {
    if (!ThumbnailCacheService.instance) {
      ThumbnailCacheService.instance = new ThumbnailCacheService();
    }
    return ThumbnailCacheService.instance;
  }

  /**
   * Generer cache-nøkkel basert på fil-identifikatorer
   */
  private generateCacheKey(fileUri: string, fileSize?: number): string {
    // Bruk kun filstørrelse som cache-nøkkel hvis tilgjengelig
    if (fileSize && fileSize > 0) {
        return `thumbnail_size_${fileSize}`;
    }
    
    // Fallback til fil-sti basert nøkkel
    const pathParts = fileUri.split('/').filter(part => part.length > 0).slice(-2);
    const fileName = pathParts.length > 0 ? pathParts.join('_') : 'unknown';
    return `${fileName}_unknown`;
    }

  /**
   * Cache thumbnail etter generering i optimistisk melding
   */
  cacheThumbnail(fileUri: string, fileSize: number | undefined, thumbnailUri: string, width: number, height: number): void {
    const cacheKey = this.generateCacheKey(fileUri, fileSize);
    
    this.cache.set(cacheKey, {
      uri: thumbnailUri,
      width,
      height,
      timestamp: Date.now()
    });

    console.log(`📦 Cached thumbnail for ${cacheKey}: ${width}x${height}`);
  }

  /**
   * Hent cached thumbnail hvis tilgjengelig
   */
  getCachedThumbnail(fileUri: string, fileSize?: number): CachedThumbnail | null {
    const cacheKey = this.generateCacheKey(fileUri, fileSize);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Sjekk om cache er utløpt
    if (Date.now() - cached.timestamp > this.maxCacheAge) {
      this.cache.delete(cacheKey);
      console.log(`📦 Removed expired thumbnail cache for ${cacheKey}`);
      return null;
    }

    console.log(`📦 Using cached thumbnail for ${cacheKey}: ${cached.width}x${cached.height}`);
    return cached;
  }

  /**
   * Sjekk om thumbnail er cached
   */
  hasCachedThumbnail(fileUri: string, fileSize?: number): boolean {
    return this.getCachedThumbnail(fileUri, fileSize) !== null;
  }

  /**
   * Fjern gammel cache
   */
  cleanupOldCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.maxCacheAge) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`📦 Cleaned up ${cleanedCount} expired thumbnail cache entries`);
    }
  }

  /**
   * Tøm hele cachen
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`📦 Cleared ${size} thumbnail cache entries`);
  }

  /**
   * Få cache-statistikk
   */
  getCacheStats(): { size: number; oldestTimestamp: number | null } {
    let oldestTimestamp: number | null = null;

    for (const cached of this.cache.values()) {
      if (oldestTimestamp === null || cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestTimestamp
    };
  }
}