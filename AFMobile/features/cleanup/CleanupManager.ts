// features/cleanup/CleanupManager.ts
import { AttachmentCacheService } from '../crypto/storage/AttachmentCacheService';
import { ThumbnailCacheService } from '@/features/cryptoAttachments/services/ThumbnailCacheService';
import { TempFileService } from '../crypto/storage/TempFileService';
import { conversationKeysCache, ConversationKeysCache } from '../crypto/storage/ConversationKeyCache';


export interface CleanupConfig {
  // Cleanup intervals
  maintenanceInterval?: number;     // How often to run maintenance
  aggressiveCleanupInterval?: number; // How often to run aggressive cleanup
  
  // Storage thresholds
  cacheWarningThreshold?: number;   // 0-1, when to warn about cache usage
  tempWarningThreshold?: number;    // 0-1, when to warn about temp usage
  criticalThreshold?: number;       // 0-1, when to force aggressive cleanup
  
  // Cache limits (bytes)
  maxCacheSize?: number;
  maxTempSize?: number;
  
  // Cleanup priorities
  protectConversationKeys?: boolean; // Never cleanup conversation keys
  enableAggressiveCleanup?: boolean; // Allow aggressive cleanup when critical
}

export interface CleanupStats {
  lastMaintenance: number | null;
  lastAggressiveCleanup: number | null;
  totalCleanupRuns: number;
  totalFilesRemoved: number;
  totalSpaceFreed: number;
  avgCleanupTime: number;
}

export interface StorageHealth {
  cache: {
    usage: number;        // 0-1
    size: number;         // bytes
    status: 'healthy' | 'warning' | 'critical';
  };
  temp: {
    usage: number;
    size: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  overall: 'healthy' | 'warning' | 'critical';
  needsCleanup: boolean;
  needsAggressiveCleanup: boolean;
}

export class CleanupManager {
  private static instance: CleanupManager;
  
  // Service references
  private attachmentCache: AttachmentCacheService;
  private thumbnailCache: ThumbnailCacheService;
  private tempFileService: TempFileService;
  private conversationKeysCache: ConversationKeysCache;
  
  // Configuration
  private config: Required<CleanupConfig>;
  
  // Timers
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private aggressiveCleanupTimer: NodeJS.Timeout | null = null;
  
  // Stats
  private stats: CleanupStats = {
    lastMaintenance: null,
    lastAggressiveCleanup: null,
    totalCleanupRuns: 0,
    totalFilesRemoved: 0,
    totalSpaceFreed: 0,
    avgCleanupTime: 0
  };
  
  private cleanupTimes: number[] = [];

  private constructor(config: CleanupConfig = {}) {
    // Default configuration
    this.config = {
      maintenanceInterval: config.maintenanceInterval ?? 30 * 60 * 1000, // 30 minutes
      aggressiveCleanupInterval: config.aggressiveCleanupInterval ?? 10 * 60 * 1000, // 10 minutes
      cacheWarningThreshold: config.cacheWarningThreshold ?? 0.8, // 80%
      tempWarningThreshold: config.tempWarningThreshold ?? 0.8, // 80%
      criticalThreshold: config.criticalThreshold ?? 0.95, // 95%
      maxCacheSize: config.maxCacheSize ?? 500 * 1024 * 1024, // 500MB
      maxTempSize: config.maxTempSize ?? 1024 * 1024 * 1024, // 1GB
      protectConversationKeys: config.protectConversationKeys ?? true,
      enableAggressiveCleanup: config.enableAggressiveCleanup ?? true
    };
    
    // Initialize service references
    this.attachmentCache = AttachmentCacheService.getInstance();
    this.thumbnailCache = ThumbnailCacheService.getInstance();
    this.tempFileService = TempFileService.getInstance();
    this.conversationKeysCache = conversationKeysCache;
    
    this.startCleanupScheduler();
  }

  public static getInstance(config?: CleanupConfig): CleanupManager {
    if (!CleanupManager.instance) {
      CleanupManager.instance = new CleanupManager(config);
    }
    return CleanupManager.instance;
  }

  /**
   * Analyser current storage health
   */
  async analyzeStorageHealth(): Promise<StorageHealth> {
    const attachmentStats = this.attachmentCache.getCacheStats();
    const tempStats = this.tempFileService.getTempStorageStats();
    
    const cacheUsage = attachmentStats.totalSize / this.config.maxCacheSize;
    const tempUsage = tempStats.totalSize / this.config.maxTempSize;
    
    const cacheStatus = this.getHealthStatus(cacheUsage);
    const tempStatus = this.getHealthStatus(tempUsage);
    
    const needsCleanup = cacheUsage > this.config.cacheWarningThreshold || 
                        tempUsage > this.config.tempWarningThreshold;
    
    const needsAggressiveCleanup = cacheUsage > this.config.criticalThreshold || 
                                  tempUsage > this.config.criticalThreshold;
    
    const overall = this.getOverallStatus(cacheStatus, tempStatus);

    return {
      cache: {
        usage: cacheUsage,
        size: attachmentStats.totalSize,
        status: cacheStatus
      },
      temp: {
        usage: tempUsage,
        size: tempStats.totalSize,
        status: tempStatus
      },
      overall,
      needsCleanup,
      needsAggressiveCleanup
    };
  }

  private getHealthStatus(usage: number): 'healthy' | 'warning' | 'critical' {
    if (usage >= this.config.criticalThreshold) return 'critical';
    if (usage >= this.config.cacheWarningThreshold) return 'warning';
    return 'healthy';
  }

  private getOverallStatus(
    cacheStatus: 'healthy' | 'warning' | 'critical',
    tempStatus: 'healthy' | 'warning' | 'critical'
  ): 'healthy' | 'warning' | 'critical' {
    if (cacheStatus === 'critical' || tempStatus === 'critical') return 'critical';
    if (cacheStatus === 'warning' || tempStatus === 'warning') return 'warning';
    return 'healthy';
  }

  /**
   * Perform regular maintenance cleanup
   */
  async performMaintenance(): Promise<void> {
    const startTime = Date.now();
    console.log('🧹 Starting regular maintenance cleanup...');
    
    try {
      let filesRemoved = 0;
      let spaceFreed = 0;

      // Cleanup expired items (safe operations)
      const attachmentsBefore = this.attachmentCache.getCacheStats();
      await this.attachmentCache.cleanupExpiredCache();
      const attachmentsAfter = this.attachmentCache.getCacheStats();
      
      filesRemoved += attachmentsBefore.totalFiles - attachmentsAfter.totalFiles;
      spaceFreed += attachmentsBefore.totalSize - attachmentsAfter.totalSize;

      // Cleanup thumbnail metadata
      const thumbnailsBefore = this.thumbnailCache.getCacheStats();
      this.thumbnailCache.cleanupOldCache();
      const thumbnailsAfter = this.thumbnailCache.getCacheStats();
      
      filesRemoved += thumbnailsBefore.size - thumbnailsAfter.size;

      // TempFileService and ConversationKeysCache have their own cleanup
      
      const duration = Date.now() - startTime;
      this.updateStats('maintenance', duration, filesRemoved, spaceFreed);
      
      console.log(`🧹 Maintenance completed: ${filesRemoved} files removed, ${Math.round(spaceFreed / 1024 / 1024)}MB freed in ${duration}ms`);
      
    } catch (error) {
      console.error('🧹 Maintenance failed:', error);
    }
  }

  /**
   * Perform aggressive cleanup when storage is critical
   */
  async performAggressiveCleanup(): Promise<void> {
    if (!this.config.enableAggressiveCleanup) {
      console.log('🧹 Aggressive cleanup disabled in configuration');
      return;
    }

    const health = await this.analyzeStorageHealth();
    if (!health.needsAggressiveCleanup) {
      console.log('🧹 Aggressive cleanup not needed');
      return;
    }

    const startTime = Date.now();
    console.log('🧹 Starting aggressive cleanup...');
    
    try {
      let filesRemoved = 0;
      let spaceFreed = 0;

      // Aggressive cache cleanup (but protect conversation keys)
      if (health.cache.status === 'critical') {
        const spaceNeeded = health.cache.size * 0.3; // Free 30% of current usage
        const freed = await this.aggressiveCacheCleanup(spaceNeeded);
        spaceFreed += freed.space;
        filesRemoved += freed.files;
      }

      // Temp storage cleanup is handled by TempFileService automatically
      if (health.temp.status === 'critical') {
        console.log('🧹 Temp storage critical - TempFileService will handle cleanup automatically');
      }

      const duration = Date.now() - startTime;
      this.updateStats('aggressive', duration, filesRemoved, spaceFreed);
      
      console.log(`🧹 Aggressive cleanup completed: ${filesRemoved} files removed, ${Math.round(spaceFreed / 1024 / 1024)}MB freed in ${duration}ms`);
      
    } catch (error) {
      console.error('🧹 Aggressive cleanup failed:', error);
    }
  }

  /**
   * Aggressive cache cleanup - removes oldest files first
   * NEVER touches conversation keys
   */
  private async aggressiveCacheCleanup(spaceNeeded: number): Promise<{files: number, space: number}> {
    console.log(`🧹 Performing aggressive cache cleanup, need ${Math.round(spaceNeeded / 1024 / 1024)}MB`);
    
    // This would need to be implemented in AttachmentCacheService
    // For now, just trigger regular cleanup
    const before = this.attachmentCache.getCacheStats();
    await this.attachmentCache.cleanupExpiredCache();
    const after = this.attachmentCache.getCacheStats();
    
    return {
      files: before.totalFiles - after.totalFiles,
      space: before.totalSize - after.totalSize
    };
  }

  /**
   * Ensure storage health before new operations
   */
  async ensureStorageHealth(newFileSize: number, willUseCache: boolean): Promise<void> {
    const health = await this.analyzeStorageHealth();
    
    if (willUseCache && health.cache.status !== 'healthy') {
      console.log(`🧹 Cache ${health.cache.status}, performing preemptive cleanup`);
      
      if (health.cache.status === 'critical') {
        await this.performAggressiveCleanup();
      } else {
        await this.performMaintenance();
      }
    }
    
    if (!willUseCache && health.temp.status !== 'healthy') {
      console.log(`🧹 Temp storage ${health.temp.status}, TempFileService will handle cleanup`);
      // TempFileService handles its own cleanup automatically
    }
  }

  /**
   * Clear specific cache types
   */
  async clearCache(type: 'all' | 'attachments' | 'thumbnails' | 'temp' | 'keys'): Promise<void> {
    const startTime = Date.now();
    console.log(`🧹 Clearing ${type} cache...`);
    
    try {
      switch (type) {
        case 'all':
          await this.attachmentCache.clearCache();
          this.thumbnailCache.clearCache();
          await this.tempFileService.clearAllTempFiles();
          // NEVER clear conversation keys automatically
          break;
        case 'attachments':
          await this.attachmentCache.clearCache();
          break;
        case 'thumbnails':
          this.thumbnailCache.clearCache();
          break;
        case 'temp':
          await this.tempFileService.clearAllTempFiles();
          break;
        case 'keys':
          if (this.config.protectConversationKeys) {
            console.warn('🧹 Conversation keys are protected - use forceClearConversationKeys() if needed');
            return;
          }
          this.conversationKeysCache.clearAll();
          break;
      }
      
      const duration = Date.now() - startTime;
      console.log(`🧹 Cleared ${type} cache in ${duration}ms`);
      
    } catch (error) {
      console.error(`🧹 Failed to clear ${type} cache:`, error);
    }
  }

  /**
   * Force clear conversation keys (bypasses protection)
   */
  forceClearConversationKeys(): void {
    console.warn('🧹 FORCE clearing conversation keys - this may impact security!');
    this.conversationKeysCache.clearAll();
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Regular maintenance
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }
    
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance().catch(console.error);
    }, this.config.maintenanceInterval);

    // Aggressive cleanup monitoring
    if (this.config.enableAggressiveCleanup) {
      if (this.aggressiveCleanupTimer) {
        clearInterval(this.aggressiveCleanupTimer);
      }
      
      this.aggressiveCleanupTimer = setInterval(() => {
        this.analyzeStorageHealth().then(health => {
          if (health.needsAggressiveCleanup) {
            this.performAggressiveCleanup().catch(console.error);
          }
        }).catch(console.error);
      }, this.config.aggressiveCleanupInterval);
    }

    console.log(`🧹 Cleanup scheduler started:
      - Maintenance every ${this.config.maintenanceInterval / 1000 / 60} minutes
      - Aggressive cleanup monitoring every ${this.config.aggressiveCleanupInterval / 1000 / 60} minutes`);
  }

  /**
   * Update cleanup statistics
   */
  private updateStats(type: 'maintenance' | 'aggressive', duration: number, filesRemoved: number, spaceFreed: number): void {
    this.stats.totalCleanupRuns++;
    this.stats.totalFilesRemoved += filesRemoved;
    this.stats.totalSpaceFreed += spaceFreed;
    
    this.cleanupTimes.push(duration);
    if (this.cleanupTimes.length > 100) {
      this.cleanupTimes = this.cleanupTimes.slice(-50); // Keep last 50 times
    }
    
    this.stats.avgCleanupTime = this.cleanupTimes.reduce((a, b) => a + b, 0) / this.cleanupTimes.length;
    
    if (type === 'maintenance') {
      this.stats.lastMaintenance = Date.now();
    } else {
      this.stats.lastAggressiveCleanup = Date.now();
    }
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): CleanupStats {
    return { ...this.stats };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<CleanupConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduler with new intervals if they changed
    if (newConfig.maintenanceInterval || newConfig.aggressiveCleanupInterval) {
      this.startCleanupScheduler();
    }
    
    console.log('🧹 Cleanup configuration updated');
  }

  /**
   * Shutdown cleanup manager
   */
  shutdown(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    
    if (this.aggressiveCleanupTimer) {
      clearInterval(this.aggressiveCleanupTimer);
      this.aggressiveCleanupTimer = null;
    }
    
    console.log('🧹 CleanupManager shut down');
  }
}

// Export singleton
export const cleanupManager = CleanupManager.getInstance();