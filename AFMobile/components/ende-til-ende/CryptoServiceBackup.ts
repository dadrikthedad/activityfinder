// crypto/CryptoServiceBackup.ts
import { Buffer } from 'buffer';
import sodium from "@s77rt/react-native-sodium";
import { CryptoService } from './CryptoService';
import authServiceNative from '@/services/user/authServiceNative';
import { getMyPublicKey, storePublicKey, storeRecoverySeed  } from '@/services/crypto/cryptoService';
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
 * Generate a 24-word backup phrase from private key (using full 32-byte entropy)
 */
async generateBackupPhrase(privateKey: string): Promise<string> {
  try {
    console.log('🔑 DEBUG: Generating backup phrase from private key');
    console.log('🔑 DEBUG: Private key (base64):', privateKey);
    
    // Convert private key (seed) to entropy for BIP39
    const seedBuffer = this.base64ToArrayBuffer(privateKey);
    console.log('🔑 DEBUG: Seed buffer length:', seedBuffer.byteLength);
    
    // Use ALL 32 bytes as entropy (256-bit entropy = 24 words)
    const entropy = new Uint8Array(seedBuffer); 
    console.log('🔑 DEBUG: Entropy bytes (all 32):', Array.from(entropy));
    
    // Convert Uint8Array to hex string for BIP39
    const entropyHex = Array.from(entropy)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('🔑 DEBUG: Entropy hex:', entropyHex);
    
    // Generate BIP39 mnemonic from entropy (24 words for 256-bit entropy)
    const mnemonic = entropyToMnemonic(entropyHex);
    console.log('🔑 DEBUG: Generated mnemonic:', mnemonic);
    console.log('🔑 DEBUG: Word count:', mnemonic.split(' ').length);
    
    console.log('Generated BIP39 backup phrase with full entropy');
    return mnemonic;
  } catch (error) {
    throw new Error(`Failed to generate BIP39 backup phrase: ${error}`);
  }
}

/**
 * Restore private key from backup phrase (24 words)
 */
async restorePrivateKeyFromPhrase(backupPhrase: string): Promise<string> {
  try {
    console.log('🔑 DEBUG: Restoring private key from backup phrase');
    console.log('🔑 DEBUG: Backup phrase:', backupPhrase);
    
    // Validate BIP39 mnemonic
    if (!validateMnemonic(backupPhrase.trim())) {
      throw new Error('Invalid BIP39 backup phrase');
    }

    // Convert BIP39 mnemonic back to entropy (256-bit = 32 bytes)
    const entropyHex = mnemonicToEntropy(backupPhrase.trim());
    console.log('🔑 DEBUG: Restored entropy hex:', entropyHex);
    
    // Convert hex string back to Uint8Array (full 32 bytes)
    const fullSeed = new Uint8Array(
      entropyHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    console.log('🔑 DEBUG: Restored seed bytes:', Array.from(fullSeed));
    console.log('🔑 DEBUG: Restored seed length:', fullSeed.length);
    
    const restoredSeedBase64 = this.arrayBufferToBase64(fullSeed.buffer);
    console.log('🔑 DEBUG: Restored seed (base64):', restoredSeedBase64);

    return restoredSeedBase64;
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

      // Upload backup phrase to vault
      await this.storeBackupPhraseToVault(backupPhrase);
      
      console.log(`E2EE setup complete for user ${userId}`);
      
      return { keyPair, backupPhrase };
    } catch (error) {
      throw new Error(`E2EE setup failed: ${error}`);
    }
  }

  /**
 * Restore E2EE from backup phrase on new device or from old phrase
 */
async restoreE2EEFromBackup(
  backupPhrase: string, 
  userId: number, 
  skipServerValidation: boolean = false
): Promise<KeyPair> {
  try {
    console.log(`Restoring E2EE from backup for user ${userId}${skipServerValidation ? ' (skip validation)' : ''}`);

    // Restore private key from phrase
    const privateKey = await this.restorePrivateKeyFromPhrase(backupPhrase);
    
    // Generate corresponding public key
    const publicKey = await this.getPublicKeyFromSeed(privateKey);
    
    if (!skipServerValidation) {
      // Normal validation - verify this matches the user's stored public key on backend
      const isValidRestore = await this.verifyRestoredKey(userId, publicKey);
      if (!isValidRestore) {
        throw new Error('Backup phrase does not match this user account');
      }
    } else {
      // Skip validation mode - replace server public key with restored key
      console.log('🔄 Skipping validation, uploading restored public key to server');
      await this.uploadPublicKeyToBackend(userId, publicKey);
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
      console.log('🔍 Verifying restored key against server...');
      console.log('🔍 Restored public key:', restoredPublicKey);
      
      // Get the user's own stored public key from backend - FIXED ENDPOINT
      const response = await authServiceNative.fetchWithAuth(
        `${authServiceNative['baseURL']}/api/e2ee/public-key`,  // Changed from /users/public-keys
        {
          method: 'GET'  // Changed from POST
          // Removed body since it's GET request
        }
      );

      if (!response.ok) {
        console.log('🔍 Server response not OK:', response.status);
        if (response.status === 404) {
          console.log('🔍 No public key found for user - this should not happen during restore');
        }
        return false;
      }

      const userKeyData = await response.json();
      console.log('🔍 Server response:', userKeyData);
      console.log('🔍 Server public key:', userKeyData.publicKey);
      
      const matches = userKeyData.publicKey === restoredPublicKey;
      console.log('🔍 Keys match:', matches);
      
      return matches;
    } catch (error) {
      console.error('Failed to verify restored key:', error);
      return false;
    }
  }

  /**
 * Generate public key from seed (private key) - FIXED VERSION
 */
public async getPublicKeyFromSeed(seedBase64: string): Promise<string> {
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

/**
 * Store secret phrase in vault
 * @param buffer 
 * @returns 
 */
private async storeBackupPhraseToVault(backupPhrase: string): Promise<void> {
  try {
    console.log('KEY VAULT: Storing backup phrase to server..')

    const result = await storeRecoverySeed(backupPhrase);

    if (result) {
      console.log(`KEY VAULT: Backup phrase stored successfully on device ${result.deviceId}.`);
    } else {
      throw new Error('KEY VAULT: Failed to store backup phrase - no response');
    }
  } catch (error) {
    console.error(`KEY VAULT: Failed to store backup phrase to server: `, error)
    throw new Error(`KEY VAULT: Backup phrase storage failed: ${error}`);
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