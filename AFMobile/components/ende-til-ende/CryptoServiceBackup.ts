// crypto/CryptoServiceBackup.ts
import { Buffer } from 'buffer';
import sodium from "@s77rt/react-native-sodium";
import { CryptoService } from './CryptoService';
import authServiceNative from '@/services/user/authServiceNative';
import { getMyPublicKey, storePublicKey } from '@/services/crypto/cryptoService';
import { validateMnemonic, entropyToMnemonic, mnemonicToEntropy } from 'bip39';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface E2EESetupResult {
  keyPair: KeyPair;
  backupPhrase: string;
}

export interface InitializationResult {
  needsSetup: boolean;
  needsRestore: boolean;
}

export class CryptoServiceBackup {
  private static instance: CryptoServiceBackup;
  private cryptoService: CryptoService;
  private readonly NETWORK_TIMEOUT_MS = 8000;

  static getInstance(): CryptoServiceBackup {
    if (!CryptoServiceBackup.instance) {
      CryptoServiceBackup.instance = new CryptoServiceBackup();
    }
    return CryptoServiceBackup.instance;
  }

  constructor() {
    this.cryptoService = CryptoService.getInstance();
  }

  /**
 * Generate a 12-word backup phrase from private key
 */
async generateBackupPhrase(privateKey: string): Promise<string> {
  try {
    // Convert private key (seed) to entropy for BIP39
    const seedBuffer = this.base64ToArrayBuffer(privateKey);
    const entropy = new Uint8Array(seedBuffer.slice(0, 16)); // Use first 16 bytes (128-bit entropy)
    
    // Convert Uint8Array to hex string for BIP39
    const entropyHex = Array.from(entropy)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Generate BIP39 mnemonic from entropy using standard bip39
    const mnemonic = entropyToMnemonic(entropyHex);
    
    console.log('Generated BIP39 backup phrase with standard security');
    return mnemonic;
  } catch (error) {
    throw new Error(`Failed to generate BIP39 backup phrase: ${error}`);
  }
}

 /**
 * Restore private key from backup phrase
 */
async restorePrivateKeyFromPhrase(backupPhrase: string): Promise<string> {
  try {
    // Validate BIP39 mnemonic using standard bip39
    if (!validateMnemonic(backupPhrase.trim())) {
      throw new Error('Invalid BIP39 backup phrase');
    }

    // Convert BIP39 mnemonic back to entropy using standard bip39
    const entropyHex = mnemonicToEntropy(backupPhrase.trim());
    
    // Convert hex string back to Uint8Array
    const entropy = new Uint8Array(
      entropyHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    // Create full 32-byte seed by padding the entropy
    const fullSeed = new Uint8Array(32);
    fullSeed.set(entropy, 0); // Place entropy at start
    
    // Fill remaining bytes with deterministic data derived from entropy
    for (let i = entropy.length; i < 32; i++) {
      fullSeed[i] = entropy[i % entropy.length] ^ (i * 7); // Simple deterministic fill
    }

    // Convert to base64 for compatibility with existing system
    return this.arrayBufferToBase64(fullSeed.buffer);
  } catch (error) {
    throw new Error(`Failed to restore key from BIP39 backup phrase: ${error}`);
  }
}


  /**
   * Setup E2EE with backup phrase for new users
   */
  async setupE2EEWithBackup(userId: number): Promise<E2EESetupResult> {
    try {
      console.log(`Setting up E2EE with backup for user ${userId}`);

      // Generate new key pair
      const keyPair = await this.cryptoService.generateKeyPair();
      
      // Generate backup phrase from private key
      const backupPhrase = await this.generateBackupPhrase(keyPair.privateKey);
      
      // Store private key securely
      await this.cryptoService.storePrivateKey(keyPair.privateKey, userId);
      
      // Upload public key to backend for this user
      await this.uploadPublicKeyToBackend(userId, keyPair.publicKey);
      
      console.log(`E2EE setup complete for user ${userId}`);
      
      return { keyPair, backupPhrase };
    } catch (error) {
      throw new Error(`E2EE setup failed: ${error}`);
    }
  }

  /**
   * Restore E2EE from backup phrase on new device
   */
  async restoreE2EEFromBackup(backupPhrase: string, userId: number): Promise<KeyPair> {
    try {
      console.log(`Restoring E2EE from backup for user ${userId}`);

      // Restore private key from phrase
      const privateKey = await this.restorePrivateKeyFromPhrase(backupPhrase);
      
      // Generate corresponding public key
      const publicKey = await this.getPublicKeyFromSeed(privateKey);
      
      // Verify this matches the user's stored public key on backend
      const isValidRestore = await this.verifyRestoredKey(userId, publicKey);
      if (!isValidRestore) {
        throw new Error('Backup phrase does not match this user account');
      }
      
      // Store restored key
      await this.cryptoService.storePrivateKey(privateKey, userId);
      
      const keyPair = { publicKey, privateKey };
      
      console.log(`E2EE restored successfully for user ${userId}`);
      
      return keyPair;
    } catch (error) {
      throw new Error(`E2EE restore failed: ${error}`);
    }
  }

  /**
   * Initialize crypto service for user with network timeout handling
   */
  async initializeForUser(userId: number): Promise<{needsSetup: boolean, needsRestore: boolean}> {
    try {
      console.log(`Initializing CryptoServiceBackup for user ${userId}...`);
      
      // Check local keychain first (this is fast and offline)
      const hasLocalKey = await this.checkLocalKey(userId);
      console.log(`🔐 DEBUG: Checking keychain for user ${userId}`);
      
      if (hasLocalKey) {
        console.log(`Existing key pair found for user ${userId}`);
        
        // Try to verify with server, but don't let it block if network is slow
        try {
          const hasServerKey = await this.checkServerKeyWithTimeout(userId);
          
          if (hasServerKey) {
            return { needsSetup: false, needsRestore: false };
          } else {
            // Local key exists but not on server - needs setup (upload to server)
            return { needsSetup: true, needsRestore: false };
          }
        } catch (networkError) {
          console.warn('🔶 Network check failed, proceeding with local keys:', networkError);
          // If network fails, assume local keys are valid and continue
          // This allows offline usage when we have local keys
          return { needsSetup: false, needsRestore: false };
        }
      } else {
        // No local key - check if user has keys on server
        try {
          const hasServerKey = await this.checkServerKeyWithTimeout(userId);
          
          if (hasServerKey) {
            // Server has key but we don't have local - needs restore
            return { needsSetup: false, needsRestore: true };
          } else {
            // Neither local nor server has keys - needs complete setup
            return { needsSetup: true, needsRestore: false };
          }
        } catch (networkError) {
          console.warn('🔶 Network check failed, assuming new user setup needed:', networkError);
          // If network fails and no local keys, assume new setup needed
          return { needsSetup: true, needsRestore: false };
        }
      }
      
    } catch (error) {
      console.error(`Failed to initialize CryptoServiceBackup for user ${userId}:`, error);
      throw new Error(`CryptoServiceBackup initialization failed: ${error}`);
    }
  }

  /**
   * Check if user has local private key (offline check)
   */
  private async checkLocalKey(userId: number): Promise<boolean> {
    try {
      const cryptoService = CryptoService.getInstance();
      const privateKey = await cryptoService.getPrivateKeySafe(userId);
      
      if (privateKey) {
        console.log(`🔐 DEBUG: Keychain entry exists: true`);
        console.log(`🔐 DEBUG: Retrieved seed from keychain for user ${userId}, length:`, privateKey.length);
        console.log(`🔐 DEBUG: Retrieved private key: true`, privateKey.length);
        return true;
      }
      
      console.log(`🔐 DEBUG: Keychain entry exists: false`);
      return false;
    } catch (error) {
      console.error('Error checking local key:', error);
      return false;
    }
  }

  /**
   * Check if user has public key on server with timeout and retry
   */
  private async checkServerKeyWithTimeout(userId: number): Promise<boolean> {
    const MAX_RETRIES = 2; // Mindre retries for server check
    const RETRY_DELAY = 1000; // 1 sekund mellom forsøk
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔍 Checking E2EE setup for user ${userId} (attempt ${attempt}/${MAX_RETRIES})`);
        
        const result = await this.performServerKeyCheck(userId);
        console.log(`🔍 Server key check result: ${result}`);
        return result;
        
      } catch (error) {
        console.error(`❌ Server key check attempt ${attempt} failed:`, error);
        
        if (attempt === MAX_RETRIES) {
          throw error; // Kast error på siste forsøk
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
    
    return false; // Fallback (bør ikke nås)
  }

   /**
   * Perform single server key check with timeout
   */
  private async performServerKeyCheck(userId: number): Promise<boolean> {
    try {
      // Race mellom getMyPublicKey og timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), this.NETWORK_TIMEOUT_MS);
      });
      
      const keyResult = await Promise.race([
        getMyPublicKey(),
        timeoutPromise
      ]);
      
      if (keyResult && keyResult.publicKey) {
        return true;
      } else {
        return false;
      }
      
    } catch (error) {
      // Type guard for error handling
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('timeout')) {
        throw new Error(`Network timeout after ${this.NETWORK_TIMEOUT_MS}ms`);
      }
      
      // 404 betyr ingen key funnet - ikke en error
      if (errorMessage.includes('404')) {
        return false;
      }
      
      throw error;
    }
  }

  /**
   * Check if user has E2EE setup on any device (has public key on backend)
   */
 private async checkUserHasE2EESetup(userId: number): Promise<boolean> {
  try {
    console.log("🔍 Checking if user has E2EE setup for userId:", userId);
    
    const publicKeyData = await getMyPublicKey();
    
    console.log("🔍 Backend response:", publicKeyData ? "has key" : "no key");
    
    return publicKeyData !== null;
  } catch (error) {
    console.error('Failed to check user E2EE setup:', error);
    return false;
  }
}

  /**
   * Upload user's public key to backend
   */
  private async uploadPublicKeyToBackend(userId: number, publicKey: string): Promise<void> {
    try {
        await storePublicKey(publicKey);
        console.log(`Public key uploaded for user ${userId}`);
    } catch (error) {
        console.error('Failed to upload public key:', error);
        throw error;
    }
    }

  /**
   * Verify that restored key matches user's backend public key
   */
  private async verifyRestoredKey(userId: number, restoredPublicKey: string): Promise<boolean> {
    try {
      // Get the user's stored public key from backend
      const response = await authServiceNative.fetchWithAuth(
        `${authServiceNative['baseURL']}/api/e2ee/users/public-keys`,
        {
          method: 'POST',
          body: JSON.stringify([userId])
        }
      );

      if (!response.ok) {
        return false;
      }

      const keys = await response.json();
      
      // Find this user's key
      const userKey = keys.find((key: any) => key.userId === userId);
      if (!userKey) {
        return false;
      }

      return userKey.publicKey === restoredPublicKey;
    } catch (error) {
      console.error('Failed to verify restored key:', error);
      return false;
    }
  }

  /**
 * Generate public key from seed (private key) - FIXED VERSION
 */
private async getPublicKeyFromSeed(seedBase64: string): Promise<string> {
  try {
    if (sodium.sodium_init() < 0) {
      throw new Error("Failed to initialize sodium!");
    }
    
    const seed = this.base64ToArrayBuffer(seedBase64);
    
    if (seed.byteLength !== 32) {
      throw new Error(`Invalid seed size: ${seed.byteLength}, expected 32`);
    }

    // Generate keypair from seed
    const publicKey = new ArrayBuffer(sodium.crypto_box_PUBLICKEYBYTES);
    const secretKey = new ArrayBuffer(sodium.crypto_box_SECRETKEYBYTES);
    
    const result = sodium.crypto_box_seed_keypair(publicKey, secretKey, seed);
    if (result !== 0) {
      throw new Error(`crypto_box_seed_keypair failed with code ${result}`);
    }

    return this.arrayBufferToBase64(publicKey);
  } catch (error) {
    console.error('Failed to generate public key from seed:', error);
    throw error;
  }
}

  // Utility methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return Buffer.from(new Uint8Array(buffer)).toString('base64');
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    return Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
  }
}