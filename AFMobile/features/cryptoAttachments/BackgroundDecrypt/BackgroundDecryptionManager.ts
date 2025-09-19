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
  taskId?: string; // For cancellation support
}

interface DecryptionResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  fileSize?: number;
}

type QueueEventType = 'started' | 'completed' | 'failed' | 'paused' | 'resumed' | 'cleared';

interface QueueEvent {
  type: QueueEventType;
  item?: QueueItem;
  error?: string;
  queueLength: number;
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
    console.log(`📦 BACKGROUND: User set to ${userId}`);
  }

  private async initializeUser(): Promise<void> {
    // Try to get user from crypto service
    try {
      // You'll need to implement a way to get current user ID
      // This is a placeholder - replace with your actual user retrieval
      const userKeys = this.cryptoService.getCachedKeys(1); // Replace with actual user ID
      if (userKeys) {
        this.currentUserId = 1; // Replace with actual user ID
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
      conversationId
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
    
    // Resume processing if we have items in queue
    if (this.queue.length > 0 && !this.isProcessing) {
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
   * Add conversation attachments to queue
   */
  public async addConversationAttachments(
    attachments: AttachmentDto[], 
    conversationId: number,
    priority: 'high' | 'normal' | 'low' = 'low',
    includeVideos: boolean = false
  ): Promise<string[]> {
    const addedIds: string[] = [];
    
    // Filter for files that need decryption and aren't cached
    const needDecryptionPromises = attachments
      .filter(att => {
        if (!att.needsDecryption) return false;
        
        // Skip videos if not included
        if (!includeVideos && att.fileType.startsWith('video/')) {
          console.log(`📦 BACKGROUND: Skipping video ${att.fileName} - videos excluded`);
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

    // Prioritize based on file type and size
    const sortedAttachments = this.sortAttachmentsByPriority(needDecryption);

    console.log(`📦 BACKGROUND: Adding ${sortedAttachments.length} attachments from conversation ${conversationId} (videos ${includeVideos ? 'included' : 'excluded'})`);
    
    for (const attachment of sortedAttachments) {
      const id = await this.addToQueue(attachment, priority, conversationId);
      if (id) addedIds.push(id);
    }

    return addedIds;
  }

  /**
   * Main queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`📦 BACKGROUND: Starting queue processing (${this.queue.length} items)`);

    while (this.queue.length > 0 && !this.isPaused) {
      this.currentItem = this.queue.shift()!;
      console.log(`📦 BACKGROUND: Processing ${this.currentItem.attachment.fileName}`);

      const startTime = Date.now();
      
      try {
        const result = await this.decryptAttachment(this.currentItem);
        const processingTime = Date.now() - startTime;
        
        this.updateStats(true, processingTime);
        
        if (result.success) {
          console.log(`📦 BACKGROUND: ✅ Completed ${this.currentItem.attachment.fileName} in ${processingTime}ms`);
          this.emitEvent({ 
            type: 'completed', 
            item: this.currentItem, 
            queueLength: this.queue.length 
          });
        } else {
          console.log(`📦 BACKGROUND: ❌ Failed ${this.currentItem.attachment.fileName}: ${result.error}`);
          this.emitEvent({ 
            type: 'failed', 
            item: this.currentItem, 
            error: result.error,
            queueLength: this.queue.length 
          });
        }
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        this.updateStats(false, processingTime);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`📦 BACKGROUND: ❌ Error processing ${this.currentItem.attachment.fileName}:`, error);
        
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
        throw new Error('No current user set for background decryption');
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
          // Optional: emit progress events
          console.log(`📦 BACKGROUND: ${attachment.fileName} - ${progress}% ${message}`);
        }
      );

      const result = await this.currentDecryptionPromise;

      if (result?.fileUrl) {
        return {
          success: true,
          fileUrl: result.fileUrl,
          fileSize: result.fileSize
        };
      } else {
        return {
          success: false,
          error: 'No file URL returned from decryption'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decryption failed'
      };
    }
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
   * Sort attachments by decryption priority
   */
  private sortAttachmentsByPriority(attachments: AttachmentDto[]): AttachmentDto[] {
    return attachments.sort((a, b) => {
      // Images first, then documents, then videos
      const getTypePriority = (att: AttachmentDto) => {
        if (att.fileType.startsWith('image/')) return 1;
        if (att.fileType.startsWith('application/')) return 2;
        if (att.fileType.startsWith('video/')) return 3;
        return 4;
      };
      
      const typeA = getTypePriority(a);
      const typeB = getTypePriority(b);
      
      // Different file types - use type priority
      if (typeA !== typeB) return typeA - typeB;
      
      // Same file type - prioritize smaller files
      const sizeA = a.fileSize || 0;
      const sizeB = b.fileSize || 0;
      return sizeA - sizeB;
    });
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
      currentItem: this.currentItem?.attachment.fileName || null
    };
  }

  public getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentItem: this.currentItem,
      queue: this.queue.map(item => ({
        id: item.id,
        fileName: item.attachment.fileName,
        priority: item.priority,
        addedAt: item.addedAt
      }))
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
export const backgroundDecryptionManager = BackgroundDecryptionManager.getInstance();