// crypto/CryptoService.ts - CORRECTED VERSION BASED ON SODIUM DOCS
import * as Keychain from 'react-native-keychain';
import { Buffer } from 'buffer';
import sodium from "@s77rt/react-native-sodium";
import authServiceNative from '@/services/user/authServiceNative';


export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedMessage {
  encryptedText: string | null;
  keyInfo: { [userId: string]: string };
  iv: string;
  version: number;
}

export class CryptoService {
  private static instance: CryptoService;
  private userSeed: string | null = null; // Store the 32-byte seed
  private userPublicKey: string | null = null; // Cache 32-byte public key
  private userSecretKey: string | null = null; // Cache 64-byte secret key
  private keyCache: Map<number, { seed: string; publicKey: string; secretKey: string }> = new Map();
  private initialized = false;

  static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * Initialize sodium library
   */
  private async initializeSodium(): Promise<void> {
    if (this.initialized) return;
    
    try {
      if (sodium.sodium_init() < 0) {
        throw new Error("Failed to initialize sodium!");
      }
      this.initialized = true;
      console.log('🔐 Sodium initialized successfully');
    } catch (error) {
      throw new Error(`Sodium initialization failed: ${error}`);
    }
  }

  /**
   * Generate X25519 key pair using Sodium - CORRECTED VERSION
   */
  async generateKeyPair(): Promise<KeyPair> {
    try {
      await this.initializeSodium();

      // Generate 32-byte random seed
      const seed = new ArrayBuffer(32);
      sodium.randombytes_buf(seed, seed.byteLength);

      // Generate keypair from seed
      const publicKey = new ArrayBuffer(sodium.crypto_box_PUBLICKEYBYTES); // 32 bytes
      const secretKey = new ArrayBuffer(sodium.crypto_box_SECRETKEYBYTES); // 64 bytes
      
      const result = sodium.crypto_box_seed_keypair(publicKey, secretKey, seed);
      if (result !== 0) {
        throw new Error(`crypto_box_seed_keypair failed with code ${result}`);
      }

      const publicKeyBase64 = this.arrayBufferToBase64(publicKey);
      const seedBase64 = this.arrayBufferToBase64(seed);

      console.log('🔐 DEBUG: New keypair generated:', {
        publicKey: publicKeyBase64,
        seedLength: seed.byteLength,
        publicKeyLength: publicKey.byteLength,
        secretKeyLength: secretKey.byteLength
      });

      return {
        publicKey: publicKeyBase64,
        privateKey: seedBase64 // We store the seed as "privateKey" for compatibility
      };
    } catch (error) {
      throw new Error(`Key generation failed: ${error}`);
    }
  }

  /**
   * Store private key (seed) securely using React Native Keychain
   */
  async storePrivateKey(seedBase64: string, userId: number): Promise<void> {
    try {
      if (!seedBase64?.trim()) {
        throw new Error('Private key cannot be empty');
      }

      await Keychain.setInternetCredentials(
        `e2ee_private_key_${userId}`,
        userId.toString(),
        seedBase64,
        {
          storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
        }
      );

      // Generate and cache all keys from the seed
      const keyData = this.generateKeysFromSeed(seedBase64);
      this.keyCache.set(userId, keyData);
      
      // Set instance variables
      this.userSeed = seedBase64;
      this.userPublicKey = keyData.publicKey;
      this.userSecretKey = keyData.secretKey;
      
      console.log('🔐 ✅ Private key stored and all keys cached successfully');
    } catch (error) {
      console.error('🔐 ❌ Failed to store private key:', error);
      throw new Error(`Private key storage failed: ${error}`);
    }
  }

  /**
   * Generate public and secret keys from seed
   */
  public generateKeysFromSeed(seedBase64: string): { seed: string; publicKey: string; secretKey: string } {
    try {
      const seed = this.base64ToArrayBuffer(seedBase64);
      
      if (seed.byteLength !== 32) {
        throw new Error(`Invalid seed size: ${seed.byteLength}, expected 32`);
      }

      // Generate keypair from seed
      const publicKey = new ArrayBuffer(sodium.crypto_box_PUBLICKEYBYTES); // 32 bytes
      const secretKey = new ArrayBuffer(sodium.crypto_box_SECRETKEYBYTES); // 64 bytes
      
      const result = sodium.crypto_box_seed_keypair(publicKey, secretKey, seed);
      if (result !== 0) {
        throw new Error(`crypto_box_seed_keypair failed with code ${result}`);
      }

      return {
        seed: seedBase64,
        publicKey: this.arrayBufferToBase64(publicKey),
        secretKey: this.arrayBufferToBase64(secretKey)
      };
    } catch (error) {
      console.error('🔐 ❌ Failed to generate keys from seed:', error);
      throw error;
    }
  }

  /**
   * Retrieve private key (seed) from secure storage
   */
  public async getPrivateKey(userId: number): Promise<string | null> {
    try {
      // Check cache first
      if (this.keyCache.has(userId)) {
        const cachedData = this.keyCache.get(userId)!;
        console.log(`🔐 DEBUG: Using cached seed for user ${userId}, length:`, cachedData.seed.length);
        return cachedData.seed;
      }
      
      const credentials = await Keychain.getInternetCredentials(`e2ee_private_key_${userId}`);
      
      if (credentials && credentials.password) {
        console.log(`🔐 DEBUG: Retrieved seed from keychain for user ${userId}, length:`, credentials.password.length);
        
        // Generate and cache all keys from the seed
        const keyData = this.generateKeysFromSeed(credentials.password);
        this.keyCache.set(userId, keyData);
        
        // Set instance variables
        this.userSeed = credentials.password;
        this.userPublicKey = keyData.publicKey;
        this.userSecretKey = keyData.secretKey;
        
        return credentials.password;
      }
      
      return null;
    } catch (error) {
      console.error('🔐 ❌ Failed to retrieve private key:', error);
      return null;
    }
  }

  /**
   * Get cached keys for user
   */
  public getCachedKeys(userId: number): { publicKey: ArrayBuffer; secretKey: ArrayBuffer } | null {
    const cachedData = this.keyCache.get(userId);
    if (!cachedData) return null;

    return {
      publicKey: this.base64ToArrayBuffer(cachedData.publicKey),
      secretKey: this.base64ToArrayBuffer(cachedData.secretKey)
    };
  }

  /**
   * Clear private key from memory and storage
   */
  async clearPrivateKey(userId: number): Promise<void> {
    try {
      await Keychain.resetInternetCredentials({
        server: `e2ee_private_key_${userId}`
      });
      this.keyCache.delete(userId);
      this.userSeed = null;
      this.userPublicKey = null;
      this.userSecretKey = null;
      console.log('🔐 ✅ Private key cleared successfully');
    } catch (error) {
      console.error('🔐 ❌ Failed to clear private key:', error);
    }
  }

  /**
 * Ensure keys are cached for a user
 */
  public async ensureKeysAreCached(userId: number, seedBase64?: string): Promise<void> {
    try {
      // Check if already cached
      if (this.keyCache.has(userId)) {
        return;
      }

      // Get seed if not provided
      const seed = seedBase64 || await this.getPrivateKey(userId);
      if (!seed) {
        throw new Error(`No seed available for user ${userId}`);
      }

      // Generate and cache all keys from the seed
      const keyData = this.generateKeysFromSeed(seed);
      this.keyCache.set(userId, keyData);
      
      // Set instance variables if this is the current user
      const currentUserId = await authServiceNative.getCurrentUserId();
      if (currentUserId === userId) {
        this.userSeed = seed;
        this.userPublicKey = keyData.publicKey;
        this.userSecretKey = keyData.secretKey;
      }
      
      console.log(`🔐 ✅ Keys cached for user ${userId}`);
    } catch (error) {
      console.error(`🔐 ❌ Failed to cache keys for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Rotate keys for forward secrecy
   */
  async rotateKeys(userId: number): Promise<KeyPair> {
    try {
      const newKeyPair = await this.generateKeyPair();
      await this.storePrivateKey(newKeyPair.privateKey, userId);
      return newKeyPair;
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw new Error(`Key rotation failed: ${error}`);
    }
  }

  /**
   * Clear user cache
   */
  public clearUserCache(userId: number): void {
    console.log(`🔐 Clearing cache for user ${userId}`);
    this.keyCache.delete(userId);
    this.userSeed = null;
    this.userPublicKey = null;
    this.userSecretKey = null;
    console.log(`🔐 Cache cleared for user ${userId}`);
  }

  /**
   * Initialize crypto service for user
   */
  async initializeForUser(userId: number): Promise<void> {
    try {
      await this.initializeSodium();
      
      console.log(`🔐 Initializing CryptoService for user ${userId}...`);
      
      // Try to get existing private key from secure storage
      const existingSeed = await this.getPrivateKeySafe(userId);
      
      if (existingSeed) {
        // User has existing key pair
        const keyData = this.generateKeysFromSeed(existingSeed);
        this.keyCache.set(userId, keyData);
        this.userSeed = existingSeed;
        this.userPublicKey = keyData.publicKey;
        this.userSecretKey = keyData.secretKey;
        
        console.log(`🔐✅ Existing key pair loaded for user ${userId}`);
      } else {
        // No existing key pair - generate new one automatically
        console.log(`🔐🔧 No key pair found, generating new one for user ${userId}`);
        
        const newKeyPair = await this.generateKeyPair();
        await this.storePrivateKey(newKeyPair.privateKey, userId);
        
        console.log(`🔐✅ New key pair generated and stored for user ${userId}`);
      }
      
      console.log(`🔐✅ CryptoService initialized for user ${userId}`);
    } catch (error) {
      console.error(`Failed to initialize CryptoService for user ${userId}:`, error);
      
      // Clear any partial state
      this.userSeed = null;
      this.userPublicKey = null;
      this.userSecretKey = null;
      this.keyCache.delete(userId);
      
      throw new Error(`CryptoService initialization failed for user ${userId}: ${error}`);
    }
  }

  /**
   * Safe private key retrieval
   */
  async getPrivateKeySafe(userId: number): Promise<string | null> {
    try {
      return await this.getPrivateKey(userId);
    } catch (error) {
      console.error('Safe private key retrieval failed:', error);
      
      // If key is corrupted, remove it and let user set up new one
      await this.clearPrivateKey(userId);
      return null;
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