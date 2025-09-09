// features/cryptoAttachments/services/FileEncryptionService.ts
// Denne har hovedlogikken til decryptFiles og encryptFiles som brukes med AttachmentDecryptionService og AttachmentEncryptionService

import { Buffer } from 'buffer';
import sodium from "@s77rt/react-native-sodium";
import { EncryptedFile } from '../types/cryptoAttachmentTypes';



export class FileEncryptionService {
  private static instance: FileEncryptionService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): FileEncryptionService {
    if (!FileEncryptionService.instance) {
      FileEncryptionService.instance = new FileEncryptionService();
    }
    return FileEncryptionService.instance;
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
      console.log('🔐 FileEncryptionService: Sodium initialized successfully');
    } catch (error) {
      throw new Error(`Sodium initialization failed: ${error}`);
    }
  }

  /**
   * Encrypt file data using hybrid approach
   * 1. Generate temporary keypair
   * 2. Encrypt file with temporary keys using crypto_box_easy
   * 3. Create key package (tempPublicKey + tempSecretKey) 
   * 4. Encrypt key package for each recipient using crypto_box_seal
   */
  async encryptFile(fileData: ArrayBuffer, recipientPublicKeys: { [userId: string]: string }): Promise<EncryptedFile> {
    try {
      await this.initializeSodium();

      // Validate recipients
      if (!recipientPublicKeys || Object.keys(recipientPublicKeys).length === 0) {
        throw new Error('At least one recipient public key is required');
      }

      console.log('🔐🐛 FILE ENCRYPT DEBUG:', {
        fileSizeBytes: fileData.byteLength,
        recipientCount: Object.keys(recipientPublicKeys).length,
        recipientUserIds: Object.keys(recipientPublicKeys)
      });

      // Step 1: Generate temporary keypair for file encryption
      const tempPublicKey = new ArrayBuffer(sodium.crypto_box_PUBLICKEYBYTES); // 32 bytes
      const tempSecretKey = new ArrayBuffer(sodium.crypto_box_SECRETKEYBYTES); // 32 bytes
      const result = sodium.crypto_box_keypair(tempPublicKey, tempSecretKey);
      
      if (result !== 0) {
        throw new Error(`Failed to generate temporary keypair: ${result}`);
      }

      console.log('🔐🐛 Generated temporary keypair:', {
        tempPublicKeyLength: tempPublicKey.byteLength,
        tempSecretKeyLength: tempSecretKey.byteLength
      });

      // Step 2: Encrypt file with temporary keypair using crypto_box_easy
      const nonce = new ArrayBuffer(sodium.crypto_box_NONCEBYTES);
      sodium.randombytes_buf(nonce, nonce.byteLength);
      
      const encryptedFileData = new ArrayBuffer(fileData.byteLength + sodium.crypto_box_MACBYTES);
      const encryptResult = sodium.crypto_box_easy(
        encryptedFileData, 
        fileData, 
        fileData.byteLength, 
        nonce, 
        tempPublicKey, 
        tempSecretKey
      );
      
      if (encryptResult !== 0) {
        throw new Error(`File encryption failed with code ${encryptResult}`);
      }

      console.log('🔐🐛 File encrypted with temporary keys:', {
        originalSize: fileData.byteLength,
        encryptedSize: encryptedFileData.byteLength,
        overhead: sodium.crypto_box_MACBYTES
      });

      // Step 3: Create key package (tempPublicKey + tempSecretKey)
      const keyPackage = new ArrayBuffer(tempPublicKey.byteLength + tempSecretKey.byteLength);
      const keyPackageView = new Uint8Array(keyPackage);
      keyPackageView.set(new Uint8Array(tempPublicKey), 0);
      keyPackageView.set(new Uint8Array(tempSecretKey), tempPublicKey.byteLength);

      console.log('🔐🐛 Created key package:', {
        totalSize: keyPackage.byteLength,
        publicKeySize: tempPublicKey.byteLength,
        secretKeySize: tempSecretKey.byteLength
      });

      // Step 4: Encrypt key package for each recipient using crypto_box_seal
      const keyInfo: { [userId: string]: string } = {};
      
      for (const [userId, publicKeyBase64] of Object.entries(recipientPublicKeys)) {
        try {
          const recipientPublicKey = this.base64ToArrayBuffer(publicKeyBase64);
          
          console.log(`🔐🐛 Encrypting key package for user ${userId}:`, {
            publicKeyLength: recipientPublicKey.byteLength,
            keyPackageSize: keyPackage.byteLength
          });

          // Validate public key size
          if (recipientPublicKey.byteLength !== sodium.crypto_box_PUBLICKEYBYTES) {
            throw new Error(`Invalid public key size for user ${userId}: ${recipientPublicKey.byteLength}, expected ${sodium.crypto_box_PUBLICKEYBYTES}`);
          }

          // Encrypt the key package using crypto_box_seal
          const sealedKeyPackage = new ArrayBuffer(keyPackage.byteLength + sodium.crypto_box_SEALBYTES);
          
          const sealResult = sodium.crypto_box_seal(
            sealedKeyPackage, 
            keyPackage, 
            keyPackage.byteLength, 
            recipientPublicKey
          );

          if (sealResult !== 0) {
            throw new Error(`Failed to encrypt key package for user ${userId}: ${sealResult}`);
          }
          
          keyInfo[userId] = this.arrayBufferToBase64(sealedKeyPackage);
          console.log(`🔐 ✅ Successfully encrypted key package for user ${userId}`);

        } catch (error) {
          console.error(`🔐 ❌ Failed to encrypt key package for user ${userId}:`, error);
          throw error;
        }
      }

      const resultData = {
        encryptedData: this.arrayBufferToBase64(encryptedFileData), // The actual encrypted file
        keyInfo, // Encrypted key packages for each recipient
        iv: this.arrayBufferToBase64(nonce),
        version: 1
      };

      console.log('🔐 ✅ Hybrid file encryption completed successfully');
      return resultData;

    } catch (error) {
      console.error('🔐 ❌ File encryption failed:', error);
      throw new Error(`File encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt file data using hybrid approach
   * 1. Decrypt key package (tempPublicKey + tempSecretKey) using crypto_box_seal_open
   * 2. Extract tempPublicKey and tempSecretKey from package
   * 3. Decrypt file using crypto_box_open_easy with temp keys
   */
  async decryptFile(
    encryptedFile: EncryptedFile,
    userId: number,
    userKeys: { publicKey: ArrayBuffer; secretKey: ArrayBuffer }
  ): Promise<ArrayBuffer | null> {
    try {
      await this.initializeSodium();

      if (!encryptedFile?.keyInfo) {
        throw new Error('Invalid encrypted file format');
      }

      // Check version compatibility
      if (encryptedFile.version && encryptedFile.version !== 1) {
        throw new Error(`Unsupported file version: ${encryptedFile.version}. Expected version 1.`);
      }

      const userEncryptedKeyPackage = encryptedFile.keyInfo[userId.toString()];
      if (!userEncryptedKeyPackage) {
        console.log('🔐 DEBUG: No encrypted key package for user', userId);
        return null;
      }

      console.log('🔐🐛 DECRYPT FILE DEBUG:', {
        userId: userId,
        hasEncryptedData: !!encryptedFile.encryptedData,
        keyPackageLength: userEncryptedKeyPackage.length,
        userPublicKeyLength: userKeys.publicKey.byteLength,
        userSecretKeyLength: userKeys.secretKey.byteLength
      });

      // Step 1: Decrypt the key package using crypto_box_seal_open
      const sealedKeyPackage = this.base64ToArrayBuffer(userEncryptedKeyPackage);
      
      if (sealedKeyPackage.byteLength <= sodium.crypto_box_SEALBYTES) {
        throw new Error(`Sealed key package too short: ${sealedKeyPackage.byteLength}, minimum ${sodium.crypto_box_SEALBYTES + 1}`);
      }

      const keyPackageSize = sealedKeyPackage.byteLength - sodium.crypto_box_SEALBYTES;
      const keyPackage = new ArrayBuffer(keyPackageSize);

      console.log('🔐🐛 About to decrypt key package:', {
        sealedPackageLength: sealedKeyPackage.byteLength,
        expectedKeyPackageLength: keyPackageSize
      });

      const unsealResult = sodium.crypto_box_seal_open(
        keyPackage,
        sealedKeyPackage,
        sealedKeyPackage.byteLength,
        userKeys.publicKey,
        userKeys.secretKey
      );

      if (unsealResult !== 0) {
        console.error('🔐 ❌ KEY PACKAGE DECRYPTION FAILED:', {
          resultCode: unsealResult,
          sealedLength: sealedKeyPackage.byteLength,
          expectedKeyPackageLength: keyPackageSize
        });
        throw new Error(`crypto_box_seal_open failed with code ${unsealResult}`);
      }

      console.log('🔐 ✅ Key package decrypted successfully');

      // Step 2: Extract tempPublicKey and tempSecretKey from key package
      const expectedPublicKeySize = sodium.crypto_box_PUBLICKEYBYTES; // 32 bytes
      const expectedSecretKeySize = sodium.crypto_box_SECRETKEYBYTES; // 32 bytes
      const expectedTotalSize = expectedPublicKeySize + expectedSecretKeySize; // 64 bytes

      if (keyPackage.byteLength !== expectedTotalSize) {
        throw new Error(`Invalid key package size: ${keyPackage.byteLength}, expected ${expectedTotalSize}`);
      }

      const tempPublicKey = keyPackage.slice(0, expectedPublicKeySize);
      const tempSecretKey = keyPackage.slice(expectedPublicKeySize, expectedPublicKeySize + expectedSecretKeySize);

      console.log('🔐🐛 Extracted temp keys:', {
        tempPublicKeyLength: tempPublicKey.byteLength,
        tempSecretKeyLength: tempSecretKey.byteLength
      });

      // Step 3: Decrypt the file using temp keys
      const encryptedFileData = this.base64ToArrayBuffer(encryptedFile.encryptedData);
      const nonce = this.base64ToArrayBuffer(encryptedFile.iv);

      if (encryptedFileData.byteLength <= sodium.crypto_box_MACBYTES) {
        throw new Error(`Encrypted file too short: ${encryptedFileData.byteLength}, minimum ${sodium.crypto_box_MACBYTES + 1}`);
      }

      const decryptedFileSize = encryptedFileData.byteLength - sodium.crypto_box_MACBYTES;
      const decryptedFileData = new ArrayBuffer(decryptedFileSize);

      console.log('🔐🐛 About to decrypt file:', {
        encryptedFileLength: encryptedFileData.byteLength,
        expectedDecryptedLength: decryptedFileSize,
        nonceLength: nonce.byteLength
      });

      const decryptResult = sodium.crypto_box_open_easy(
        decryptedFileData,
        encryptedFileData,
        encryptedFileData.byteLength,
        nonce,
        tempPublicKey,
        tempSecretKey
      );

      if (decryptResult !== 0) {
        console.error('🔐 ❌ FILE DECRYPTION FAILED:', {
          resultCode: decryptResult,
          encryptedFileLength: encryptedFileData.byteLength,
          expectedDecryptedLength: decryptedFileSize,
          tempPublicKeyLength: tempPublicKey.byteLength,
          tempSecretKeyLength: tempSecretKey.byteLength,
          nonceLength: nonce.byteLength
        });
        throw new Error(`crypto_box_open_easy failed with code ${decryptResult}`);
      }

      console.log('🔐 ✅ File decryption SUCCESS:', {
        decryptedFileSize: decryptedFileData.byteLength
      });

      return decryptedFileData;
    } catch (error) {
      console.error('🔐 ❌ Failed to decrypt file:', error);
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