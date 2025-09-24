// features/cryptoAttachments/BackgroundDecrypt/BackgroundKotlinDecrypt.ts
import ExpoVideoDecryptionModule from '@/modules/expo-video-decryption/src/ExpoVideoDecryptionModule';
import sodium from '@s77rt/react-native-sodium';

export class BackgroundKotlinDecrypt {
  private static instance: BackgroundKotlinDecrypt;
  private activeDecryptions = new Map();
  private progressCallbacks = new Map();
  private initialized = false;
  private failedTasksCache = new Set<string>(); // Cache for failed tasks to avoid retry spam

  private constructor() {
    this.initializeSodium();
  }

  public static getInstance(): BackgroundKotlinDecrypt {
    if (!BackgroundKotlinDecrypt.instance) {
      BackgroundKotlinDecrypt.instance = new BackgroundKotlinDecrypt();
    }
    return BackgroundKotlinDecrypt.instance;
  }

  private async initializeSodium() {
    if (this.initialized) return;
    
    try {
      if (sodium.sodium_init() < 0) {
        throw new Error('Failed to initialize sodium');
      }
      this.initialized = true;
      console.log('🔐 BackgroundKotlinDecrypt: Sodium initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Sodium initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Validate that we have proper decryption keys before starting
   */
  private validateDecryptionKeys(userSecretKey: string, userPublicKey: string): boolean {
    if (!userSecretKey || !userPublicKey) {
      console.warn('🔐 ❌ Missing user keys for decryption');
      return false;
    }
    
    if (userSecretKey.length === 0 || userPublicKey.length === 0) {
      console.warn('🔐 ❌ Empty user keys for decryption');
      return false;
    }
    
    try {
      // Try to decode base64 keys to validate format
      this.base64ToArrayBuffer(userSecretKey);
      this.base64ToArrayBuffer(userPublicKey);
      return true;
    } catch (error) {
      console.warn('🔐 ❌ Invalid key format:', error);
      return false;
    }
  }

  /**
   * Decrypt attachment in background with progress tracking
   */
  async decryptAttachment(encryptedData: string, keyPackage: string, iv: string, userSecretKey: string, userPublicKey: string, onProgress?: (progress: number, message: string) => void) {
    await this.initializeSodium();
    
    // Early validation of keys
    if (!this.validateDecryptionKeys(userSecretKey, userPublicKey)) {
      const error = new Error('Missing or invalid decryption keys. Please set up your encryption keys first.');
      if (onProgress) {
        onProgress(0, 'Missing decryption keys');
      }
      throw error;
    }
    
    // Generate a unique cache key for this decryption attempt
    const cacheKey = this.generateCacheKey(encryptedData, keyPackage, iv);
    
    // Check if this combination has failed before
    if (this.failedTasksCache.has(cacheKey)) {
      console.log('🔐 ⚠️ Skipping previously failed decryption attempt');
      throw new Error('This decryption has failed before. Encryption keys may be incorrect.');
    }
    
    try {
      console.log('🔐 Starting background decryption...');
      
      // Start Kotlin background task
      const result = await ExpoVideoDecryptionModule.decryptAttachment(
        encryptedData, keyPackage, iv, userSecretKey, userPublicKey
      );
      
      if (result.action === 'performCryptoDecryption') {
        // Kotlin handed back control - perform actual decryption with sodium
        const taskId = result.taskId;
        this.activeDecryptions.set(taskId, { 
          startTime: Date.now(),
          cacheKey: cacheKey 
        });
        this.progressCallbacks.set(taskId, onProgress);
        
        // Start progress monitoring with timeout
        this.monitorProgress(taskId, onProgress);
        
        console.log('🔐 Performing sodium decryption with metadata:', result.metadata);
        
        // Perform the actual cryptographic decryption
        const decryptedData = await this.performSodiumDecryption(result.data);
        
        // Clean up
        this.progressCallbacks.delete(taskId);
        this.activeDecryptions.delete(taskId);
        
        return {
          success: true,
          data: decryptedData,
          taskId: taskId,
          metadata: {
            ...result.metadata,
            endTime: Date.now(),
            duration: Date.now() - result.metadata.startTime
          }
        };
      }
      
      throw new Error('Unexpected response from native module');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('🔐 ❌ Decryption failed:', error);
      
      // Cache this failure to prevent retries
      this.failedTasksCache.add(cacheKey);
      
      // Clean up any failed progress monitoring
      this.cleanupFailedDecryption(cacheKey);
      
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a cache key for failed attempts
   */
  private generateCacheKey(encryptedData: string, keyPackage: string, iv: string): string {
    // Create a short hash of the input parameters
    const combined = `${encryptedData.substring(0, 50)}_${keyPackage.substring(0, 50)}_${iv}`;
    return btoa(combined).substring(0, 20);
  }

  /**
   * Clean up failed decryption resources
   */
  private cleanupFailedDecryption(cacheKey: string): void {
    // Find and clean up any related active decryptions
    for (const [taskId, taskData] of this.activeDecryptions.entries()) {
      if (taskData.cacheKey === cacheKey) {
        console.log(`🔐 🧹 Cleaning up failed decryption: ${taskId}`);
        this.activeDecryptions.delete(taskId);
        this.progressCallbacks.delete(taskId);
        
        // Try to cancel the native task
        ExpoVideoDecryptionModule.cancelDecryption(taskId).catch(() => {
          // Ignore cancellation errors
        });
      }
    }
  }

  /**
   * Monitor progress from Kotlin side with improved error handling
   */
  private async monitorProgress(taskId: string, onProgress?: (progress: number, message: string) => void) {
    let attempts = 0;
    const maxAttempts = 20; // Reduced from 120 - only 10 seconds max monitoring
    let stuckAtProgress = 0;
    let stuckCount = 0;
    const maxStuckCount = 5; // If stuck at same progress 5 times, give up
    
    const checkProgress = async () => {
      try {
        attempts++;
        
        // Check if task was cleaned up or exceeded max attempts
        if (!this.activeDecryptions.has(taskId) || attempts > maxAttempts) {
          console.log(`🔐 ⏰ Progress monitoring stopped for ${taskId} (attempts: ${attempts})`);
          this.progressCallbacks.delete(taskId);
          return;
        }
        
        const progress = await ExpoVideoDecryptionModule.getDecryptionProgress(taskId);
        
        // Check for "Task not found" or similar error messages
        if (progress.message && (
          progress.message.includes('Task not found') || 
          progress.message.includes('completed') ||
          progress.message.includes('not found')
        )) {
          console.log(`🔐 ⚠️ Task ${taskId} not found, stopping progress monitoring`);
          this.progressCallbacks.delete(taskId);
          this.activeDecryptions.delete(taskId);
          return;
        }
        
        // Check if we're stuck at the same progress
        if (progress.progress === stuckAtProgress) {
          stuckCount++;
          if (stuckCount >= maxStuckCount) {
            console.log(`🔐 ⚠️ Task ${taskId} stuck at ${progress.progress}%, stopping monitoring`);
            this.progressCallbacks.delete(taskId);
            this.activeDecryptions.delete(taskId);
            
            // Mark as failed
            const taskData = this.activeDecryptions.get(taskId);
            if (taskData?.cacheKey) {
              this.failedTasksCache.add(taskData.cacheKey);
            }
            return;
          }
        } else {
          stuckAtProgress = progress.progress;
          stuckCount = 0;
        }
        
        if (onProgress && progress.progress !== undefined) {
          onProgress(progress.progress, progress.message);
        }
        
        if (progress.progress < 100 && this.progressCallbacks.has(taskId)) {
          setTimeout(checkProgress, 500);
        } else {
          this.progressCallbacks.delete(taskId);
        }
        
      } catch (error) {
        console.warn('🔐 ⚠️ Progress monitoring error:', error);
        this.progressCallbacks.delete(taskId);
        this.activeDecryptions.delete(taskId);
      }
    };
    
    // Start monitoring after a short delay
    setTimeout(checkProgress, 100);
  }

  /**
   * Clear failed tasks cache - call this when user updates their keys
   */
  public clearFailedTasksCache(): void {
    console.log(`🔐 🧹 Clearing failed tasks cache (${this.failedTasksCache.size} entries)`);
    this.failedTasksCache.clear();
  }

  /**
   * Check if a specific file combination has failed before
   */
  public hasFailedBefore(encryptedData: string, keyPackage: string, iv: string): boolean {
    const cacheKey = this.generateCacheKey(encryptedData, keyPackage, iv);
    return this.failedTasksCache.has(cacheKey);
  }

  /**
   * Perform actual sodium-based decryption - MATCHES FileEncryptionService hybrid approach
   */
  private async performSodiumDecryption({ encryptedData, keyPackage, iv, userSecretKey, userPublicKey }: any) {
    try {
      // Convert base64 inputs to ArrayBuffer
      const sealedKeyPackage = this.base64ToArrayBuffer(keyPackage);
      const encryptedFileData = this.base64ToArrayBuffer(encryptedData);
      const nonce = this.base64ToArrayBuffer(iv);
      const userSecretKeyBuffer = this.base64ToArrayBuffer(userSecretKey);
      const userPublicKeyBuffer = this.base64ToArrayBuffer(userPublicKey);
      
      console.log('🔐🐛 BACKGROUND DECRYPT DEBUG:', {
        sealedKeyPackageLength: sealedKeyPackage.byteLength,
        encryptedFileLength: encryptedFileData.byteLength,
        nonceLength: nonce.byteLength,
        userPublicKeyLength: userPublicKeyBuffer.byteLength,
        userSecretKeyLength: userSecretKeyBuffer.byteLength
      });
      
      // Validate input sizes
      this.validateInputSizes(userPublicKeyBuffer, userSecretKeyBuffer, nonce, sealedKeyPackage, encryptedFileData);
      
      // Step 1: Decrypt key package using crypto_box_seal_open
      const keyPackageSize = sealedKeyPackage.byteLength - sodium.crypto_box_SEALBYTES;
      const decryptedKeyPackage = new ArrayBuffer(keyPackageSize);
      
      const unsealResult = sodium.crypto_box_seal_open(
        decryptedKeyPackage,
        sealedKeyPackage,
        sealedKeyPackage.byteLength,
        userPublicKeyBuffer,
        userSecretKeyBuffer
      );
      
      if (unsealResult !== 0) {
        throw new Error(`Key decryption failed - incorrect encryption keys (error code: ${unsealResult})`);
      }
      
      console.log('🔐 ✅ Key package decrypted successfully');
      
      // Step 2: Extract tempPublicKey and tempSecretKey from key package
      const expectedPublicKeySize = sodium.crypto_box_PUBLICKEYBYTES; // 32 bytes
      const expectedSecretKeySize = sodium.crypto_box_SECRETKEYBYTES; // 32 bytes  
      const expectedTotalSize = expectedPublicKeySize + expectedSecretKeySize; // 64 bytes
      
      if (decryptedKeyPackage.byteLength !== expectedTotalSize) {
        throw new Error(`Invalid key package size: ${decryptedKeyPackage.byteLength}, expected ${expectedTotalSize}`);
      }
      
      const tempPublicKey = decryptedKeyPackage.slice(0, expectedPublicKeySize);
      const tempSecretKey = decryptedKeyPackage.slice(expectedPublicKeySize, expectedPublicKeySize + expectedSecretKeySize);
      
      console.log('🔐🐛 Extracted temp keys:', {
        tempPublicKeyLength: tempPublicKey.byteLength,
        tempSecretKeyLength: tempSecretKey.byteLength
      });
      
      // Step 3: Decrypt file data using temp keys
      const decryptedFileSize = encryptedFileData.byteLength - sodium.crypto_box_MACBYTES;
      const decryptedFileData = new ArrayBuffer(decryptedFileSize);
      
      const decryptResult = sodium.crypto_box_open_easy(
        decryptedFileData,
        encryptedFileData,
        encryptedFileData.byteLength,
        nonce,
        tempPublicKey,  // Use temp public key (not user's!)
        tempSecretKey   // Use temp secret key (not user's!)
      );
      
      if (decryptResult !== 0) {
        throw new Error(`File decryption failed (error code: ${decryptResult})`);
      }
      
      console.log('🔐 ✅ File decryption SUCCESS:', {
        decryptedFileSize: decryptedFileData.byteLength
      });
      
      // Convert result to base64 for return
      return this.arrayBufferToBase64(decryptedFileData);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('🔐 ❌ Background decryption failed:', error);
      throw new Error(`Sodium decryption failed: ${errorMessage}`);
    }
  }

  async cancelDecryption(taskId: string) {
    try {
      const wasActive = this.activeDecryptions.has(taskId);
      
      if (wasActive) {
        const result = await ExpoVideoDecryptionModule.cancelDecryption(taskId);
        console.log('🔐 Cancellation result:', result);
      }
      
      this.activeDecryptions.delete(taskId);
      this.progressCallbacks.delete(taskId);
      
      return { cancelled: true, wasActive };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to cancel decryption:', error);
      return { cancelled: false, error: errorMessage };
    }
  }

  async getDecryptionStats() {
    try {
      const nativeStats = await ExpoVideoDecryptionModule.getDecryptionStats();
      
      return {
        ...nativeStats,
        activeDecryptions: this.activeDecryptions.size,
        progressCallbacks: this.progressCallbacks.size,
        failedTasksCached: this.failedTasksCache.size,
        initialized: this.initialized
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        error: errorMessage,
        activeDecryptions: this.activeDecryptions.size,
        progressCallbacks: this.progressCallbacks.size,
        failedTasksCached: this.failedTasksCache.size,
        initialized: this.initialized
      };
    }
  }

  // Utility functions
  private validateInputSizes(userPublicKey: ArrayBuffer, userSecretKey: ArrayBuffer, nonce: ArrayBuffer, sealedKeyPackage: ArrayBuffer, encryptedFileData: ArrayBuffer) {
    if (userPublicKey.byteLength !== sodium.crypto_box_PUBLICKEYBYTES) {
      throw new Error(`Invalid public key size: ${userPublicKey.byteLength}, expected ${sodium.crypto_box_PUBLICKEYBYTES}`);
    }
    if (userSecretKey.byteLength !== sodium.crypto_box_SECRETKEYBYTES) {
      throw new Error(`Invalid secret key size: ${userSecretKey.byteLength}, expected ${sodium.crypto_box_SECRETKEYBYTES}`);
    }
    if (nonce.byteLength !== sodium.crypto_box_NONCEBYTES) {
      throw new Error(`Invalid nonce size: ${nonce.byteLength}, expected ${sodium.crypto_box_NONCEBYTES}`);
    }
    if (sealedKeyPackage.byteLength <= sodium.crypto_box_SEALBYTES) {
      throw new Error(`Sealed key package too small: ${sealedKeyPackage.byteLength}, minimum ${sodium.crypto_box_SEALBYTES + 1}`);
    }
    if (encryptedFileData.byteLength <= sodium.crypto_box_MACBYTES) {
      throw new Error(`Encrypted data too small: ${encryptedFileData.byteLength}, minimum ${sodium.crypto_box_MACBYTES + 1}`);
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }
}

// Export singleton instance for convenience
export default BackgroundKotlinDecrypt.getInstance();