// services/crypto/ConversationKeysCache.ts
import { getConversationKeys } from '@/services/crypto/cryptoService';

// Type for conversation keys (adjust based on your actual type)
interface ConversationKeys {
  conversationId: number;
  participantKeys: Array<{
    userId: number;
    publicKey: string;
    keyVersion: number;
    createdAt: string;
  }>;
  keyRotationVersion: number;
}

interface CachedKeys {
  keys: ConversationKeys;
  version: number;
  timestamp: number;
}

export class ConversationKeysCache {
  private static instance: ConversationKeysCache;
  private cache = new Map<number, CachedKeys>();
  
  // Cache TTL: 5 minutes - balance between performance and security
  private readonly CACHE_TTL = 5 * 60 * 1000;
  
  // Max cache size to prevent memory leaks
  private readonly MAX_CACHE_SIZE = 50;

  private constructor() {
    // Start cleanup interval
    this.startCleanupInterval();
  }

  public static getInstance(): ConversationKeysCache {
    if (!ConversationKeysCache.instance) {
      ConversationKeysCache.instance = new ConversationKeysCache();
    }
    return ConversationKeysCache.instance;
  }

  /**
   * Get conversation keys with caching
   */
  async getKeys(conversationId: number): Promise<ConversationKeys | null> {
    const cached = this.cache.get(conversationId);
    
    // Check if we have valid cached keys
    if (cached && this.isCacheValid(cached)) {
      console.log(`🔑📦 Using cached keys for conversation ${conversationId} (v${cached.version})`);
      return cached.keys;
    }
    
    // Fetch fresh keys from API
    console.log(`🔑🌐 Fetching fresh keys for conversation ${conversationId}`);
    
    try {
      const keys = await getConversationKeys(conversationId);
      
      if (keys) {
        // Log key rotation if detected
        if (cached && cached.version !== keys.keyRotationVersion) {
          console.log(`🔑🔄 Key rotation detected for conversation ${conversationId}: v${cached.version} -> v${keys.keyRotationVersion}`);
        }
        
        // Cache the new keys
        this.setCache(conversationId, keys);
        return keys;
      }
      
      console.warn(`🔑⚠️ No keys returned for conversation ${conversationId}`);
      return null;
    } catch (error) {
      console.error(`🔑❌ Failed to fetch keys for conversation ${conversationId}:`, error);
      
      // Return cached keys if available, even if expired, as fallback
      if (cached) {
        console.log(`🔑🆘 Using expired cached keys as fallback for conversation ${conversationId}`);
        return cached.keys;
      }
      
      throw error;
    }
  }

  /**
   * Manually invalidate cache for a conversation
   */
  invalidate(conversationId: number): void {
    const wasPresent = this.cache.delete(conversationId);
    if (wasPresent) {
      console.log(`🔑🗑️ Invalidated cache for conversation ${conversationId}`);
    }
  }

  /**
   * Clear all cached keys
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🔑🧹 Cleared all cached keys (${size} conversations)`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalCached: number;
    validCached: number;
    expiredCached: number;
  } {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    this.cache.forEach((cached) => {
      if (this.isCacheValid(cached)) {
        validCount++;
      } else {
        expiredCount++;
      }
    });

    return {
      totalCached: this.cache.size,
      validCached: validCount,
      expiredCached: expiredCount
    };
  }

  /**
   * Preload keys for a conversation (useful for anticipated usage)
   */
  async preload(conversationId: number): Promise<void> {
    try {
      await this.getKeys(conversationId);
      console.log(`🔑⚡ Preloaded keys for conversation ${conversationId}`);
    } catch (error) {
      console.warn(`🔑⚠️ Failed to preload keys for conversation ${conversationId}:`, error);
    }
  }

  /**
   * Check if cached keys are still valid
   */
  private isCacheValid(cached: CachedKeys): boolean {
    return (Date.now() - cached.timestamp) < this.CACHE_TTL;
  }

  /**
   * Set cache with size management
   */
  private setCache(conversationId: number, keys: ConversationKeys): void {
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestEntry();
    }

    this.cache.set(conversationId, {
      keys,
      version: keys.keyRotationVersion,
      timestamp: Date.now()
    });

    console.log(`🔑💾 Cached keys for conversation ${conversationId} (v${keys.keyRotationVersion})`);
  }

  /**
   * Remove oldest cache entry when size limit is reached
   */
  private evictOldestEntry(): void {
    let oldestTimestamp = Date.now();
    let oldestKey: number | null = null;

    this.cache.forEach((cached, conversationId) => {
      if (cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
        oldestKey = conversationId;
      }
    });

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
      console.log(`🔑🗑️ Evicted oldest cache entry for conversation ${oldestKey}`);
    }
  }

  /**
   * Clean up expired entries periodically
   */
  private startCleanupInterval(): void {
    // Run cleanup every 10 minutes
    setInterval(() => {
      this.cleanupExpired();
    }, 10 * 60 * 1000);
  }

  /**
   * Remove expired cache entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: number[] = [];

    this.cache.forEach((cached, conversationId) => {
      if (!this.isCacheValid(cached)) {
        expiredKeys.push(conversationId);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`🔑🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Get cache entry for debugging
   */
  getCacheEntry(conversationId: number): CachedKeys | undefined {
    return this.cache.get(conversationId);
  }
}

// Export singleton instance
export const conversationKeysCache = ConversationKeysCache.getInstance();