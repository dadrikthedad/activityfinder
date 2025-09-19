// features/cryptoAttachments/BackgroundDecrypt/BackgroundKotlinDecrypt.ts
import ExpoVideoDecryptionModule from '@/modules/expo-video-decryption/src/ExpoVideoDecryptionModule';
import sodium from '@s77rt/react-native-sodium';

export class BackgroundKotlinDecrypt {
  private static instance: BackgroundKotlinDecrypt;
  private activeDecryptions = new Map();
  private progressCallbacks = new Map();
  private initialized = false;

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
   * Decrypt attachment in background with progress tracking
   */
  async decryptAttachment(encryptedData: string, keyPackage: string, iv: string, userSecretKey: string, userPublicKey: string, onProgress?: (progress: number, message: string) => void) {
    await this.initializeSodium();
    
    try {
      console.log('🔐 Starting background decryption...');
      
      // Start Kotlin background task
      const result = await ExpoVideoDecryptionModule.decryptAttachment(
        encryptedData, keyPackage, iv, userSecretKey, userPublicKey
      );
      
      if (result.action === 'performCryptoDecryption') {
        // Kotlin handed back control - perform actual decryption with sodium
        const taskId = result.taskId;
        this.activeDecryptions.set(taskId, { startTime: Date.now() });
        this.progressCallbacks.set(taskId, onProgress);
        
        // Start progress monitoring (but don't await it)
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
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
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
        throw new Error(`crypto_box_seal_open failed with code ${unsealResult}`);
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
        throw new Error(`crypto_box_open_easy failed with code ${decryptResult}`);
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

  /**
   * Monitor progress from Kotlin side
   */
  private async monitorProgress(taskId: string, onProgress?: (progress: number, message: string) => void) {
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds max monitoring
    
    const checkProgress = async () => {
      try {
        attempts++;
        
        if (!this.activeDecryptions.has(taskId) || attempts > maxAttempts) {
          return;
        }
        
        const progress = await ExpoVideoDecryptionModule.getDecryptionProgress(taskId);
        
        if (onProgress && progress.progress !== undefined) {
          onProgress(progress.progress, progress.message);
        }
        
        if (progress.progress < 100 && this.progressCallbacks.has(taskId)) {
          setTimeout(checkProgress, 500);
        } else {
          this.progressCallbacks.delete(taskId);
        }
        
      } catch (error) {
        console.warn('Progress monitoring error:', error);
        this.progressCallbacks.delete(taskId);
      }
    };
    
    setTimeout(checkProgress, 100);
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
        initialized: this.initialized
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        error: errorMessage,
        activeDecryptions: this.activeDecryptions.size,
        progressCallbacks: this.progressCallbacks.size,
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