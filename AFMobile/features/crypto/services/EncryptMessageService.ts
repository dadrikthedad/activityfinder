// features/crypto/services/EncryptMessageService.ts

import { Buffer } from 'buffer';
import sodium from "@s77rt/react-native-sodium";
import { EncryptedMessage } from '@/components/ende-til-ende/CryptoService';
import authServiceNative from '@/services/user/authServiceNative';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';

export class EncryptMessageService {
  private static instance: EncryptMessageService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): EncryptMessageService {
    if (!EncryptMessageService.instance) {
      EncryptMessageService.instance = new EncryptMessageService();
    }
    return EncryptMessageService.instance;
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
      console.log('🔐 EncryptMessageService: Sodium initialized successfully');
    } catch (error) {
      throw new Error(`Sodium initialization failed: ${error}`);
    }
  }

  /**
   * Encrypt message for multiple recipients using crypto_box_seal
   */
  public async encryptMessage(
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
  public async decryptMessage(encryptedMessage: EncryptedMessage, userId?: number): Promise<string | null> {
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

      const cryptoService = CryptoService.getInstance();
    
      // Ensure we have the seed
      const seedBase64 = await cryptoService.getPrivateKey(userIdToUse);
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

      // Get cached keys or generate them - let CryptoService handle caching
      let keys = cryptoService.getCachedKeys(userIdToUse);
      if (!keys) {
        console.log('🔐🐛 No cached keys, generating from seed...');
        const keyData = cryptoService.generateKeysFromSeed(seedBase64);
        
        // Let CryptoService handle the caching by calling a method that updates its cache
        await cryptoService.ensureKeysAreCached(userIdToUse, seedBase64);
        
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
    
    const cryptoService = CryptoService.getInstance();
    const seedBase64 = await cryptoService.getPrivateKey(userId);
    if (!seedBase64) {
      console.log('🔐🐛 No seed found for user', userId);
      return;
    }

    // Test key generation consistency
    const keyData1 = cryptoService.generateKeysFromSeed(seedBase64);
    const keyData2 = cryptoService.generateKeysFromSeed(seedBase64);
    
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
    const encrypted = await this.encryptMessage(testMessage, publicKeys); // Bruker lokal metode
    const decrypted = await this.decryptMessage(encrypted, userId);       // Bruker lokal metode
    
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

  // Utility methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return Buffer.from(new Uint8Array(buffer)).toString('base64');
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    return Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
  }
}