// features/crypto/services/BackgroundDecryptionManager.ts
import { BackgroundAttachmentDecryptionService } from '@/features/cryptoAttachments/BackgroundDecrypt/BackgrundAttachmentDecryptionService';
import BackgroundKotlinDecrypt from './Android/BackgroundKotlinDecrypt';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { generateCacheKey } from '@/features/crypto/storage/utils/cacheKeyUtils';
import { unifiedCacheManager } from '@/features/crypto/storage/UnifiedCacheManager';
import { useDecryptionStore } from '@/features/crypto/store/useDecryptionStore';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';

interface QueueItem {
  id: string;
  attachment: AttachmentDto;
  priority: 'high' | 'normal' | 'low';
  addedAt: number;
  conversationId?: number;
  taskId?: string;
  retryCount?: number; // Track retry attempts
}

interface DecryptionResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  fileSize?: number;
  shouldRetry?: boolean; // Indicate if this error is retryable
}

type QueueEventType = 'started' | 'completed' | 'failed' | 'paused' | 'resumed' | 'cleared' | 'skipped';

interface QueueEvent {
  type: QueueEventType;
  item?: QueueItem;
  error?: string;
  queueLength: number;
  reason?: string; // Additional context for skipped items
}

export class BackgroundDecryptionManager {
  private static instance: BackgroundDecryptionManager;
  
  // Queue management
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private isPaused = false;
  private currentItem: QueueItem | null = null;
  private currentDecryptionPromise: Promise<any> | null = null;
  private currentUserId: number | null = null;
  private hasValidKeys = false; // Track if we have valid encryption keys
  
  // Services
  private backgroundService = BackgroundAttachmentDecryptionService.getBackgroundInstance();
  private cryptoService = CryptoService.getInstance();
  
  // Event listeners
  private listeners: ((event: QueueEvent) => void)[] = [];
  
  // Statistics
  private stats = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    totalSkipped: 0,
    averageProcessingTime: 0,
    lastProcessedAt: 0
  };

  private constructor() {
    this.initializeUser();
  }

  public static getInstance(): BackgroundDecryptionManager {
    if (!BackgroundDecryptionManager.instance) {
      BackgroundDecryptionManager.instance = new BackgroundDecryptionManager();
    }
    return BackgroundDecryptionManager.instance;
  }

  /**
   * Initialize current user - should be called when user logs in
   */
  public setCurrentUser(userId: number): void {
    this.currentUserId = userId;
    this.validateUserKeys();
    console.log(`📦 BACKGROUND: User set to ${userId}, has valid keys: ${this.hasValidKeys}`);
  }

  /**
   * Validate that current user has proper encryption keys
   */
  private validateUserKeys(): void {
    if (!this.currentUserId) {
      this.hasValidKeys = false;
      return;
    }

    try {
      const userKeys = this.cryptoService.getCachedKeys(this.currentUserId);
      this.hasValidKeys = !!(userKeys?.publicKey && userKeys?.secretKey);
      
      if (!this.hasValidKeys) {
        console.warn(`📦 BACKGROUND: No valid keys found for user ${this.currentUserId}`);
        // Clear any cached failures since they might be due to missing keys
        BackgroundKotlinDecrypt.clearFailedTasksCache();
      }
    } catch (error) {
      console.warn('📦 BACKGROUND: Error validating user keys:', error);
      this.hasValidKeys = false;
    }
  }

  /**
   * Call this when user sets up new encryption keys
   */
  public onKeysUpdated(): void {
    this.validateUserKeys();
    if (this.hasValidKeys) {
      console.log('📦 BACKGROUND: Keys updated - clearing failed tasks cache and resuming');
      BackgroundKotlinDecrypt.clearFailedTasksCache();
      
      // Resume processing if we were paused due to key issues
      if (!this.isProcessing && this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  private async initializeUser(): Promise<void> {
    // Try to get user from crypto service
    try {
      // You'll need to implement a way to get current user ID
      // This is a placeholder - replace with your actual user retrieval
      const userKeys = this.cryptoService.getCachedKeys(1); // Replace with actual user ID
      if (userKeys) {
        this.currentUserId = 1; // Replace with actual user ID
        this.validateUserKeys();
      }
    } catch (error) {
      console.warn('📦 BACKGROUND: Could not initialize user:', error);
    }
  }

  /**
   * Add attachment to decryption queue
   */
  public async addToQueue(
    attachment: AttachmentDto, 
    priority: 'high' | 'normal' | 'low' = 'normal',
    conversationId?: number
  ): Promise<string> {
    // Skip if no valid keys and we've seen this fail before
    if (!this.hasValidKeys) {
      const cacheKey = this.generateQuickCacheKey(attachment.fileUrl, attachment.keyInfo?.keyPackage || '', attachment.iv || '');
      if (BackgroundKotlinDecrypt.hasFailedBefore(attachment.fileUrl, attachment.keyInfo?.keyPackage || '', attachment.iv || '')) {
        console.log(`📦 BACKGROUND: Skipping ${attachment.fileName} - no keys and failed before`);
        return '';
      }
    }

    // Skip if already cached
    const cacheKey = generateCacheKey(attachment.fileUrl);
    if (await this.isAlreadyCached(cacheKey, attachment.fileType)) {
      console.log(`📦 BACKGROUND: Skipping ${attachment.fileName} - already cached`);
      return '';
    }

    // Skip if already in queue
    const existingItem = this.queue.find(item => 
      generateCacheKey(item.attachment.fileUrl) === cacheKey
    );
    if (existingItem) {
      console.log(`📦 BACKGROUND: ${attachment.fileName} already in queue`);
      return existingItem.id;
    }

    const queueItem: QueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      attachment,
      priority,
      addedAt: Date.now(),
      conversationId,
      retryCount: 0
    };

    // Insert based on priority
    const insertIndex = this.findInsertIndex(priority);
    this.queue.splice(insertIndex, 0, queueItem);

    console.log(`📦 BACKGROUND: Added ${attachment.fileName} to queue (${priority} priority)`);
    this.emitEvent({ type: 'started', item: queueItem, queueLength: this.queue.length });
    
    // Start processing if not already running
    if (!this.isProcessing && !this.isPaused) {
      this.processQueue();
    }

    return queueItem.id;
  }

  /**
   * Generate a quick cache key for failed task checking
   */
  private generateQuickCacheKey(fileUrl: string, keyPackage: string, iv: string): string {
    return `${fileUrl.substring(fileUrl.length - 20)}_${keyPackage.substring(0, 20)}_${iv}`;
  }

  /**
   * Main queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`📦 BACKGROUND: Starting queue processing (${this.queue.length} items, valid keys: ${this.hasValidKeys})`);

    while (this.queue.length > 0 && !this.isPaused) {
      this.currentItem = this.queue.shift()!;
      console.log(`📦 BACKGROUND: Processing ${this.currentItem.attachment.fileName}`);

      const startTime = Date.now();
      
      // Check if we should skip this item due to missing keys
      if (!this.hasValidKeys) {
        const hasFailedBefore = BackgroundKotlinDecrypt.hasFailedBefore(
          this.currentItem.attachment.fileUrl,
          this.currentItem.attachment.keyInfo?.keyPackage || '',
          this.currentItem.attachment.iv || ''
        );
        
        if (hasFailedBefore) {
          console.log(`📦 BACKGROUND: ⏭️ Skipping ${this.currentItem.attachment.fileName} - no keys and failed before`);
          this.stats.totalSkipped++;
          this.emitEvent({
            type: 'skipped',
            item: this.currentItem,
            reason: 'No encryption keys available and previously failed',
            queueLength: this.queue.length
          });
          this.currentItem = null;
          continue;
        }
      }
      
      try {
        const result = await this.decryptAttachment(this.currentItem);
        const processingTime = Date.now() - startTime;
        
        this.updateStats(result.success, processingTime);
        
        if (result.success) {
          console.log(`📦 BACKGROUND: ✅ Completed ${this.currentItem.attachment.fileName} in ${processingTime}ms`);
          this.emitEvent({ 
            type: 'completed', 
            item: this.currentItem, 
            queueLength: this.queue.length 
          });
        } else {
          // Check if we should retry
          const shouldRetry = result.shouldRetry && 
                            (this.currentItem.retryCount || 0) < 2 && // Max 2 retries
                            !result.error?.toLowerCase().includes('keys'); // Don't retry key errors
          
          if (shouldRetry) {
            console.log(`📦 BACKGROUND: 🔄 Retrying ${this.currentItem.attachment.fileName} (attempt ${(this.currentItem.retryCount || 0) + 1})`);
            this.currentItem.retryCount = (this.currentItem.retryCount || 0) + 1;
            
            // Add back to queue with lower priority
            const retryPriority = this.currentItem.priority === 'high' ? 'normal' : 'low';
            this.currentItem.priority = retryPriority;
            this.queue.push(this.currentItem);
          } else {
            console.log(`📦 BACKGROUND: ❌ Failed ${this.currentItem.attachment.fileName}: ${result.error}`);
            this.emitEvent({ 
              type: 'failed', 
              item: this.currentItem, 
              error: result.error,
              queueLength: this.queue.length 
            });
          }
        }
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        this.updateStats(false, processingTime);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`📦 BACKGROUND: ❌ Error processing ${this.currentItem.attachment.fileName}:`, error);
        
        // Check if this is a key-related error
        const isKeyError = errorMessage.toLowerCase().includes('key') || 
                          errorMessage.toLowerCase().includes('decrypt') ||
                          errorMessage.toLowerCase().includes('missing');
        
        if (isKeyError) {
          console.log(`📦 BACKGROUND: Key-related error detected, updating key validation`);
          this.validateUserKeys();
        }
        
        this.emitEvent({ 
          type: 'failed', 
          item: this.currentItem, 
          error: errorMessage,
          queueLength: this.queue.length 
        });
      }

      this.currentItem = null;
      this.currentDecryptionPromise = null;

      // Small delay to prevent overwhelming the system
      await this.sleep(100);
    }

    this.isProcessing = false;
    console.log(`📦 BACKGROUND: Queue processing completed`);
  }

  /**
   * Decrypt single attachment
   */
  private async decryptAttachment(queueItem: QueueItem): Promise<DecryptionResult> {
    const { attachment } = queueItem;

    try {
      // Check if we have a current user
      if (!this.currentUserId) {
        return {
          success: false,
          error: 'No current user set for background decryption',
          shouldRetry: false
        };
      }

      // Early key validation
      if (!this.hasValidKeys) {
        return {
          success: false,
          error: 'Missing encryption keys. Please set up your encryption keys first.',
          shouldRetry: false // Don't retry missing key errors
        };
      }

      // Create EncryptedAttachmentData
      const encryptedAttachment = {
        encryptedFileUrl: attachment.fileUrl,
        fileType: attachment.fileType,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize || 0,
        keyInfo: attachment.keyInfo || {},
        iv: attachment.iv || '',
        version: attachment.version || 1
      };
      
      this.currentDecryptionPromise = this.backgroundService.decryptAttachment(
        encryptedAttachment,
        this.currentUserId,
        (progress: number, message: string) => {
          // Only log every 20% to reduce spam
          if (progress % 20 === 0 || progress >= 95) {
            console.log(`📦 BACKGROUND: ${attachment.fileName} - ${progress}% ${message}`);
          }
        }
      );

      const result = await this.currentDecryptionPromise;

      if (result?.fileUrl) {
        const cacheKey = generateCacheKey(attachment.fileUrl);
        
        // Use the existing completeDecryption method
        useDecryptionStore.getState().completeDecryption(cacheKey, result.fileUrl);
        
        console.log(`🔐 BACKGROUND: Updated Zustand store for ${attachment.fileName}`);
        
        return {
          success: true,
          fileUrl: result.fileUrl,
          fileSize: result.fileSize
        };
      } else {
        return {
          success: false,
          error: 'No file URL returned from decryption',
          shouldRetry: true // This might be a temporary issue
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Decryption failed';
      
      // Determine if this error should trigger a retry
      const shouldRetry = !errorMessage.toLowerCase().includes('key') && 
                         !errorMessage.toLowerCase().includes('missing') &&
                         !errorMessage.toLowerCase().includes('invalid') &&
                         !errorMessage.toLowerCase().includes('incorrect');
      
      return {
        success: false,
        error: errorMessage,
        shouldRetry
      };
    }
  }

  /**
   * Pause background processing immediately
   * Used when user initiates manual decryption
   */
  public async pauseProcessing(): Promise<void> {
    if (this.isPaused) return;
    
    this.isPaused = true;
    console.log(`⏸️ BACKGROUND: Processing paused`);
    
    // Cancel current decryption if possible
    if (this.currentItem?.taskId) {
      console.log(`⏸️ BACKGROUND: Cancelling current decryption: ${this.currentItem.attachment.fileName}`);
      try {
        await BackgroundKotlinDecrypt.cancelDecryption(this.currentItem.taskId);
      } catch (error) {
        console.warn('Failed to cancel current decryption:', error);
      }
    }
    
    this.emitEvent({ type: 'paused', queueLength: this.queue.length });
  }

  /**
   * Resume background processing
   * Called when user's manual decryption is complete
   */
  public resumeProcessing(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    console.log(`▶️ BACKGROUND: Processing resumed`);
    
    this.emitEvent({ type: 'resumed', queueLength: this.queue.length });
    
    // Resume processing if we have items in queue and valid keys
    if (this.queue.length > 0 && !this.isProcessing && this.hasValidKeys) {
      this.processQueue();
    }
  }

  /**
   * Remove specific attachment from queue
   */
  public removeFromQueue(attachmentUrl: string): boolean {
    const cacheKey = generateCacheKey(attachmentUrl);
    const index = this.queue.findIndex(item => 
      generateCacheKey(item.attachment.fileUrl) === cacheKey
    );
    
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      console.log(`📦 BACKGROUND: Removed ${removed.attachment.fileName} from queue`);
      return true;
    }
    
    return false;
  }

  /**
   * Clear entire queue
   */
  public clearQueue(): void {
    const queueSize = this.queue.length;
    this.queue = [];
    console.log(`📦 BACKGROUND: Cleared queue (${queueSize} items removed)`);
    this.emitEvent({ type: 'cleared', queueLength: 0 });
  }

  /**
   * Add conversation attachments to queue with improved filtering
   */
  public async addConversationAttachments(
    attachments: AttachmentDto[], 
    conversationId: number,
    priority: 'high' | 'normal' | 'low' = 'low',
    includeVideos: boolean = false
  ): Promise<string[]> {
    const addedIds: string[] = [];
    
    // Skip if no valid keys
    if (!this.hasValidKeys) {
      console.log(`📦 BACKGROUND: Skipping conversation ${conversationId} - no valid encryption keys`);
      return addedIds;
    }
    
    // Filter for files that need decryption and aren't cached
    const needDecryptionPromises = attachments
      .filter(att => {
        if (!att.needsDecryption) return false;
        
        // Skip videos if not included
        if (!includeVideos && att.fileType.startsWith('video/')) {
          console.log(`📦 BACKGROUND: Skipping video ${att.fileName} - videos excluded`);
          return false;
        }
        
        // Skip if this specific file has failed before
        if (BackgroundKotlinDecrypt.hasFailedBefore(
          att.fileUrl,
          att.keyInfo?.keyPackage || '',
          att.iv || ''
        )) {
          console.log(`📦 BACKGROUND: Skipping ${att.fileName} - previously failed`);
          return false;
        }
        
        return true;
      })
      .map(async att => {
        const cached = await this.isAlreadyCached(generateCacheKey(att.fileUrl), att.fileType);
        return cached ? null : att;
      });
    
    const needDecryptionResults = await Promise.all(needDecryptionPromises);
    const needDecryption = needDecryptionResults.filter(Boolean) as AttachmentDto[];

    console.log(`📦 BACKGROUND: Adding ${needDecryption.length} attachments from conversation ${conversationId} (videos ${includeVideos ? 'included' : 'excluded'})`);
    
    for (const attachment of needDecryption) {
      const id = await this.addToQueue(attachment, priority, conversationId);
      if (id) addedIds.push(id);
    }

    return addedIds;
  }

  /**
   * Check if file is already cached
   */
  private async isAlreadyCached(cacheKey: string, fileType: string): Promise<boolean> {
    try {
      const cachedPath = await unifiedCacheManager.getFile(cacheKey, fileType, false);
      return !!cachedPath;
    } catch {
      return false;
    }
  }

  /**
   * Find correct insertion index based on priority
   */
  private findInsertIndex(priority: 'high' | 'normal' | 'low'): number {
    const priorityValue = { high: 3, normal: 2, low: 1 };
    const targetPriority = priorityValue[priority];
    
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityValue[this.queue[i].priority] < targetPriority) {
        return i;
      }
    }
    
    return this.queue.length;
  }

  /**
   * Event management
   */
  public addEventListener(listener: (event: QueueEvent) => void): void {
    this.listeners.push(listener);
  }

  public removeEventListener(listener: (event: QueueEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  private emitEvent(event: QueueEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  /**
   * Statistics and monitoring
   */
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed++;
    if (success) this.stats.totalSuccessful++;
    else this.stats.totalFailed++;
    
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime) / 
      this.stats.totalProcessed;
    
    this.stats.lastProcessedAt = Date.now();
  }

  public getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      hasValidKeys: this.hasValidKeys,
      currentItem: this.currentItem?.attachment.fileName || null
    };
  }

  public getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      hasValidKeys: this.hasValidKeys,
      currentItem: this.currentItem,
      queue: this.queue.map(item => ({
        id: item.id,
        fileName: item.attachment.fileName,
        priority: item.priority,
        addedAt: item.addedAt,
        retryCount: item.retryCount || 0
      }))
    };
  }

  /**
   * Force validation of current user keys - call when user logs in
   */
  public validateCurrentUser(): void {
    this.validateUserKeys();
    console.log(`📦 BACKGROUND: Key validation completed, valid: ${this.hasValidKeys}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
export const backgroundDecryptionManager = BackgroundDecryptionManager.getInstance();