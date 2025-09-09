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
  private generateKeysFromSeed(seedBase64: string): { seed: string; publicKey: string; secretKey: string } {
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
  async getPrivateKey(userId: number): Promise<string | null> {
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
   * Encrypt message for multiple recipients using crypto_box_seal
   */
  async encryptMessage(
    plaintext: string | null,
    recipientPublicKeys: { [userId: string]: string }
  ): Promise<EncryptedMessage> {
    try {
      await this.initializeSodium();

      // Validate recipients
      if (!recipientPublicKeys || Object.keys(recipientPublicKeys).length === 0) {
        throw new Error('At least one recipient public key is required');
      }

      console.log('🔐🐛 ENCRYPT DEBUG:', {
        plaintextLength: plaintext?.length,
        plaintextPreview: plaintext?.substring(0, 50),
        recipientCount: Object.keys(recipientPublicKeys).length,
        recipientUserIds: Object.keys(recipientPublicKeys)
      });

      // Handle attachment-only messages
      if (!plaintext?.trim()) {
        const dummyNonce = new ArrayBuffer(sodium.crypto_box_NONCEBYTES);
        sodium.randombytes_buf(dummyNonce, dummyNonce.byteLength);
        
        return {
          encryptedText: "",
          keyInfo: {},
          iv: this.arrayBufferToBase64(dummyNonce),
          version: 1
        };
      }

      // Encode message to buffer
      const message = new TextEncoder().encode(plaintext);
      const messageBuffer = message.buffer;

      console.log('🔐🐛 Message encoding:', {
        originalLength: plaintext.length,
        bufferLength: messageBuffer.byteLength
      });

      // Generate nonce (kept for compatibility)
      const nonce = new ArrayBuffer(sodium.crypto_box_NONCEBYTES);
      sodium.randombytes_buf(nonce, nonce.byteLength);

      // Encrypt for each recipient using crypto_box_seal
      const keyInfo: { [userId: string]: string } = {};
      
      for (const [userId, publicKeyBase64] of Object.entries(recipientPublicKeys)) {
        try {
          const recipientPublicKey = this.base64ToArrayBuffer(publicKeyBase64);
          
          console.log(`🔐🐛 Encrypting for user ${userId}:`, {
            publicKeyLength: recipientPublicKey.byteLength,
            expectedLength: sodium.crypto_box_PUBLICKEYBYTES,
            messageSize: messageBuffer.byteLength
          });

          // Validate public key size
          if (recipientPublicKey.byteLength !== sodium.crypto_box_PUBLICKEYBYTES) {
            throw new Error(`Invalid public key size for user ${userId}: ${recipientPublicKey.byteLength}, expected ${sodium.crypto_box_PUBLICKEYBYTES}`);
          }

          const sealedMessageBuffer = new ArrayBuffer(
            messageBuffer.byteLength + sodium.crypto_box_SEALBYTES
          );

          const result = sodium.crypto_box_seal(
            sealedMessageBuffer,
            messageBuffer,
            messageBuffer.byteLength,
            recipientPublicKey
          );

          console.log(`🔐🐛 Encryption result for user ${userId}:`, {
            sodiumResult: result,
            success: result === 0,
            originalSize: messageBuffer.byteLength,
            sealedSize: sealedMessageBuffer.byteLength,
            overhead: sodium.crypto_box_SEALBYTES
          });

          if (result !== 0) {
            throw new Error(`crypto_box_seal failed with code ${result} for user ${userId}`);
          }

          const encryptedBase64 = this.arrayBufferToBase64(sealedMessageBuffer);
          keyInfo[userId] = encryptedBase64;
          
          console.log(`🔐 ✅ Successfully encrypted for user ${userId}`);

        } catch (error) {
          console.error(`🔐 ❌ Failed to encrypt message for user ${userId}:`, error);
          throw error;
        }
      }

      const finalResult = {
        encryptedText: "encrypted",
        keyInfo,
        iv: this.arrayBufferToBase64(nonce),
        version: 1
      };

      console.log('🔐 ✅ Encryption completed successfully');
      return finalResult;

    } catch (error) {
      console.error('🔐 ❌ Message encryption failed:', error);
      throw new Error(`Message encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt message using crypto_box_seal_open - CORRECTED VERSION
   */
  async decryptMessage(encryptedMessage: EncryptedMessage, userId?: number): Promise<string | null> {
    try {
      await this.initializeSodium();
      
      const userIdToUse = userId || await authServiceNative.getCurrentUserId();
    
      if (!userIdToUse) {
        console.log('🔐 DEBUG: No authenticated user for decryption');
        return null;
      }

      // Handle attachment-only messages
      if (encryptedMessage.encryptedText === null || encryptedMessage.encryptedText === "") {
        console.log('🔐 DEBUG: Attachment-only message, no text to decrypt');
        return null;
      }

      // Check version compatibility
      if (encryptedMessage.version && encryptedMessage.version !== 1) {
        throw new Error(`Unsupported message version: ${encryptedMessage.version}`);
      }

      const userEncryptedData = encryptedMessage.keyInfo[userIdToUse.toString()];
      if (!userEncryptedData) {
        console.log('🔐 DEBUG: No encrypted data for user', userIdToUse);
        return null;
      }
    
      // Ensure we have the seed
      const seedBase64 = await this.getPrivateKey(userIdToUse);
      if (!seedBase64) {
        console.log('🔐 DEBUG: No seed available for user', userIdToUse);
        return null;
      }

      console.log('🔐🐛 DECRYPT DEBUG:', {
        userId: userIdToUse,
        hasSeed: !!seedBase64,
        seedLength: seedBase64.length,
        encryptedDataLength: userEncryptedData.length
      });

      // Get cached keys or generate them
      let keys = this.getCachedKeys(userIdToUse);
      if (!keys) {
        console.log('🔐🐛 No cached keys, generating from seed...');
        const keyData = this.generateKeysFromSeed(seedBase64);
        this.keyCache.set(userIdToUse, keyData);
        keys = {
          publicKey: this.base64ToArrayBuffer(keyData.publicKey),
          secretKey: this.base64ToArrayBuffer(keyData.secretKey)
        };
      }

      console.log('🔐🐛 Keys for decryption:', {
        publicKeyLength: keys.publicKey.byteLength,
        secretKeyLength: keys.secretKey.byteLength,
        expectedPublicKeyLength: sodium.crypto_box_PUBLICKEYBYTES,
        expectedSecretKeyLength: sodium.crypto_box_SECRETKEYBYTES
      });

      // Validate key sizes
      if (keys.publicKey.byteLength !== sodium.crypto_box_PUBLICKEYBYTES) {
        throw new Error(`Invalid public key size: ${keys.publicKey.byteLength}, expected ${sodium.crypto_box_PUBLICKEYBYTES}`);
      }
      if (keys.secretKey.byteLength !== sodium.crypto_box_SECRETKEYBYTES) {
        throw new Error(`Invalid secret key size: ${keys.secretKey.byteLength}, expected ${sodium.crypto_box_SECRETKEYBYTES}`);
      }

      // Decrypt the sealed message
      const sealedMessage = this.base64ToArrayBuffer(userEncryptedData);
      
      if (sealedMessage.byteLength <= sodium.crypto_box_SEALBYTES) {
        throw new Error(`Sealed message too short: ${sealedMessage.byteLength}, minimum ${sodium.crypto_box_SEALBYTES + 1}`);
      }

      const decryptedBuffer = new ArrayBuffer(
        sealedMessage.byteLength - sodium.crypto_box_SEALBYTES
      );

      console.log('🔐🐛 About to decrypt:', {
        sealedMessageLength: sealedMessage.byteLength,
        expectedDecryptedLength: decryptedBuffer.byteLength,
        sealOverhead: sodium.crypto_box_SEALBYTES
      });

      const result = sodium.crypto_box_seal_open(
        decryptedBuffer,
        sealedMessage,
        sealedMessage.byteLength,
        keys.publicKey,
        keys.secretKey
      );

      console.log('🔐🐛 Decryption result code:', result);

      if (result !== 0) {
        console.error('🔐 ❌ DECRYPTION FAILED:', {
          resultCode: result,
          sealedLength: sealedMessage.byteLength,
          expectedPlaintextLength: decryptedBuffer.byteLength,
          publicKeyLength: keys.publicKey.byteLength,
          secretKeyLength: keys.secretKey.byteLength
        });
        
        throw new Error(`crypto_box_seal_open failed with code ${result}`);
      }

      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      
      console.log('🔐 ✅ Decryption SUCCESS:', {
        decryptedLength: decryptedText.length,
        decryptedPreview: decryptedText.substring(0, 50)
      });
      
      return decryptedText;
    } catch (error) {
      console.error('🔐 ❌ Failed to decrypt message:', error);
      return null;
    }
  }

  /**
   * Debug method to verify key consistency and test encryption/decryption
   */
  async debugKeyConsistency(userId: number): Promise<void> {
    try {
      console.log('🔐🐛 === KEY CONSISTENCY DEBUG START ===');
      
      const seedBase64 = await this.getPrivateKey(userId);
      if (!seedBase64) {
        console.log('🔐🐛 No seed found for user', userId);
        return;
      }

      // Test key generation consistency
      const keyData1 = this.generateKeysFromSeed(seedBase64);
      const keyData2 = this.generateKeysFromSeed(seedBase64);
      
      console.log('🔐🐛 Key generation consistency:', {
        seedLength: seedBase64.length,
        publicKey1: keyData1.publicKey,
        publicKey2: keyData2.publicKey,
        secretKey1Length: keyData1.secretKey.length,
        secretKey2Length: keyData2.secretKey.length,
        publicKeysMatch: keyData1.publicKey === keyData2.publicKey,
        secretKeysMatch: keyData1.secretKey === keyData2.secretKey
      });

      // Test encryption/decryption roundtrip
      const testMessage = "Test message for consistency";
      const publicKeys = { [userId.toString()]: keyData1.publicKey };
      
      console.log('🔐🐛 Testing encryption/decryption roundtrip...');
      const encrypted = await this.encryptMessage(testMessage, publicKeys);
      const decrypted = await this.decryptMessage(encrypted, userId);
      
      console.log('🔐🐛 Roundtrip test result:', {
        originalMessage: testMessage,
        encryptedKeyInfo: Object.keys(encrypted.keyInfo),
        decryptedMessage: decrypted,
        roundtripSuccess: testMessage === decrypted
      });
      
      console.log('🔐🐛 === KEY CONSISTENCY DEBUG END ===');
      
    } catch (error) {
      console.error('🔐🐛 Key consistency debug failed:', error);
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