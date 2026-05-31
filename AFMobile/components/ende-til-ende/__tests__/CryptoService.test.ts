import { CryptoService } from '../CryptoService';
import * as Keychain from 'react-native-keychain';
import sodium from '@s77rt/react-native-sodium';

jest.mock('react-native-keychain');
jest.mock('@s77rt/react-native-sodium');
jest.mock('@/core/auth/authServiceNative');

// Typed references for cleaner test code
const mockedSodiumInit             = sodium.sodium_init             as jest.Mock;
const mockedRandombytesBuf         = sodium.randombytes_buf         as jest.Mock;
const mockedCryptoBoxSeedKeypair   = sodium.crypto_box_seed_keypair as jest.Mock;
const mockedSetInternetCredentials = Keychain.setInternetCredentials as jest.Mock;
const mockedGetInternetCredentials = Keychain.getInternetCredentials as jest.Mock;
const mockedResetInternetCredentials = Keychain.resetInternetCredentials as jest.Mock;

// Test constants
const USER_ID       = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OTHER_USER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const keychainKey   = (userId: string) => `e2ee_private_key_${userId}`;

// Creates a valid 32-byte seed as base64. Use different `fill` to produce unique seeds.
const makeSeed = (fill = 0x42): string => Buffer.alloc(32, fill).toString('base64');

// Configures Keychain mock to return a stored key for a given user
const mockKeychainHasKey = (userId: string, seed: string) => {
  mockedGetInternetCredentials.mockResolvedValue({ username: userId, password: seed });
};

// Configures crypto_box_seed_keypair to produce output derived from seed content,
// enabling determinism and uniqueness assertions
const useDeterministicSodium = () => {
  mockedCryptoBoxSeedKeypair.mockImplementation(
    (publicKey: ArrayBuffer, secretKey: ArrayBuffer, seed: ArrayBuffer) => {
      const byte = new Uint8Array(seed)[0];
      new Uint8Array(publicKey).fill(byte ^ 0xAA);
      new Uint8Array(secretKey).fill(byte ^ 0xBB);
      return 0;
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────

describe('CryptoService', () => {
  let sut: CryptoService;

  beforeEach(() => {
    (CryptoService as any).instance = undefined;
    sut = CryptoService.getInstance();

    mockedSodiumInit.mockReset().mockReturnValue(0);
    mockedRandombytesBuf.mockReset().mockImplementation((buf: ArrayBuffer) => {
      new Uint8Array(buf).fill(0x42);
    });
    mockedCryptoBoxSeedKeypair.mockReset().mockImplementation(
      (publicKey: ArrayBuffer, secretKey: ArrayBuffer) => {
        new Uint8Array(publicKey).fill(0x01);
        new Uint8Array(secretKey).fill(0x02);
        return 0;
      }
    );
    mockedSetInternetCredentials.mockReset().mockResolvedValue(true);
    mockedGetInternetCredentials.mockReset().mockResolvedValue(false);
    mockedResetInternetCredentials.mockReset().mockResolvedValue(true);

    const { default: authMock } = jest.requireMock('@/core/auth/authServiceNative');
    (authMock.getCurrentUserId as jest.Mock).mockReset().mockResolvedValue(null);
  });

  // ── generateKeyPair ──────────────────────────────────────────────────────────

  describe('generateKeyPair', () => {
    it('WhenCalled_ShouldReturnBase64PublicKey', async () => {
      const result = await sut.generateKeyPair();
      expect(typeof result.publicKey).toBe('string');
      expect(Buffer.from(result.publicKey, 'base64').length).toBe(32);
    });

    it('WhenCalled_ShouldReturnBase64PrivateKeySeedOf32Bytes', async () => {
      const result = await sut.generateKeyPair();
      expect(typeof result.privateKey).toBe('string');
      expect(Buffer.from(result.privateKey, 'base64').length).toBe(32);
    });

    it('WhenCalled_ShouldInitializeSodium', async () => {
      await sut.generateKeyPair();
      expect(mockedSodiumInit).toHaveBeenCalledTimes(1);
    });

    it('WhenCalledMultipleTimes_ShouldInitializeSodiumOnlyOnce', async () => {
      await sut.generateKeyPair();
      await sut.generateKeyPair();
      await sut.generateKeyPair();
      expect(mockedSodiumInit).toHaveBeenCalledTimes(1);
    });

    it('WhenCalled_ShouldRequestRandomSeedOf32Bytes', async () => {
      await sut.generateKeyPair();
      const [capturedBuffer, capturedSize] = mockedRandombytesBuf.mock.calls[0];
      expect(capturedBuffer.byteLength).toBe(32);
      expect(capturedSize).toBe(32);
    });

    it('WhenCalled_ShouldPassSeedBufferToKeyGeneration', async () => {
      await sut.generateKeyPair();
      expect(mockedCryptoBoxSeedKeypair).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('WhenCalled_ShouldPassRandomnessAsSeedToKeyGeneration', async () => {
      // The seed filled by randombytes_buf must be the exact seed passed to keypair generation
      const callOrder: string[] = [];
      let seedAfterRandom: Uint8Array | null = null;
      let seedPassedToKeypair: Uint8Array | null = null;

      mockedRandombytesBuf.mockImplementation((buf: ArrayBuffer) => {
        callOrder.push('randombytes_buf');
        new Uint8Array(buf).fill(0x99);
        seedAfterRandom = new Uint8Array(buf.slice(0));
      });
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer, seed: ArrayBuffer) => {
          callOrder.push('crypto_box_seed_keypair');
          seedPassedToKeypair = new Uint8Array(seed.slice(0));
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );

      await sut.generateKeyPair();

      expect(callOrder).toEqual(['randombytes_buf', 'crypto_box_seed_keypair']);
      expect(Array.from(seedPassedToKeypair!)).toEqual(Array.from(seedAfterRandom!));
    });

    it('WhenSodiumInitReturnsMinus1_ShouldThrow', async () => {
      mockedSodiumInit.mockReturnValue(-1);
      await expect(sut.generateKeyPair()).rejects.toThrow('Key generation failed');
    });

    it('WhenSodiumInitReturnsAnyNegativeValue_ShouldThrow', async () => {
      mockedSodiumInit.mockReturnValue(-99);
      await expect(sut.generateKeyPair()).rejects.toThrow('Key generation failed');
    });

    it('WhenCryptoBoxSeedKeypairReturnsNonZero_ShouldThrow', async () => {
      mockedCryptoBoxSeedKeypair.mockReturnValue(1);
      await expect(sut.generateKeyPair()).rejects.toThrow('Key generation failed');
    });

    it('WhenSodiumThrowsNatively_ShouldWrapError', async () => {
      mockedSodiumInit.mockImplementation(() => { throw new Error('Native module crash'); });
      await expect(sut.generateKeyPair()).rejects.toThrow('Key generation failed');
    });

    it('WhenCalled_ShouldAllocatePublicKeyBufferMatchingConstant', async () => {
      let capturedSize = 0;
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer) => {
          capturedSize = pub.byteLength;
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );
      await sut.generateKeyPair();
      expect(capturedSize).toBe(sodium.crypto_box_PUBLICKEYBYTES);
    });

    it('WhenCalled_ShouldAllocateSecretKeyBufferMatchingConstant', async () => {
      let capturedSize = 0;
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer) => {
          capturedSize = sec.byteLength;
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );
      await sut.generateKeyPair();
      expect(capturedSize).toBe(sodium.crypto_box_SECRETKEYBYTES);
    });
  });

  // ── generateKeysFromSeed ─────────────────────────────────────────────────────

  describe('generateKeysFromSeed', () => {
    it('WhenValidSeed_ShouldReturnPublicKeyOf32Bytes', () => {
      const result = sut.generateKeysFromSeed(makeSeed());
      expect(Buffer.from(result.publicKey, 'base64').length).toBe(32);
    });

    it('WhenValidSeed_ShouldReturnSecretKeyOf64Bytes', () => {
      const result = sut.generateKeysFromSeed(makeSeed());
      expect(Buffer.from(result.secretKey, 'base64').length).toBe(64);
    });

    it('WhenValidSeed_ShouldReturnOriginalSeedInResult', () => {
      const seed = makeSeed();
      const result = sut.generateKeysFromSeed(seed);
      expect(result.seed).toBe(seed);
    });

    it('WhenSameSeedUsedTwice_ShouldReturnIdenticalKeys', () => {
      // Critical: X25519 key derivation must be deterministic
      useDeterministicSodium();
      const seed = makeSeed(0x42);
      const result1 = sut.generateKeysFromSeed(seed);
      const result2 = sut.generateKeysFromSeed(seed);
      expect(result1.publicKey).toBe(result2.publicKey);
      expect(result1.secretKey).toBe(result2.secretKey);
    });

    it('WhenDifferentSeeds_ShouldReturnDifferentPublicKeys', () => {
      useDeterministicSodium();
      const result1 = sut.generateKeysFromSeed(makeSeed(0x11));
      const result2 = sut.generateKeysFromSeed(makeSeed(0x22));
      expect(result1.publicKey).not.toBe(result2.publicKey);
    });

    it('WhenDifferentSeeds_ShouldReturnDifferentSecretKeys', () => {
      useDeterministicSodium();
      const result1 = sut.generateKeysFromSeed(makeSeed(0x11));
      const result2 = sut.generateKeysFromSeed(makeSeed(0x22));
      expect(result1.secretKey).not.toBe(result2.secretKey);
    });

    it('WhenSeedIsShorterThan32Bytes_ShouldThrow', () => {
      const shortSeed = Buffer.alloc(16, 0x42).toString('base64');
      expect(() => sut.generateKeysFromSeed(shortSeed)).toThrow('Invalid seed size');
    });

    it('WhenSeedIsLongerThan32Bytes_ShouldThrow', () => {
      const longSeed = Buffer.alloc(64, 0x42).toString('base64');
      expect(() => sut.generateKeysFromSeed(longSeed)).toThrow('Invalid seed size');
    });

    it('WhenSeedIsEmpty_ShouldThrow', () => {
      expect(() => sut.generateKeysFromSeed('')).toThrow('Invalid seed size');
    });

    it('WhenCryptoBoxSeedKeypairReturnsNonZero_ShouldThrowWithCode', () => {
      mockedCryptoBoxSeedKeypair.mockReturnValue(-1);
      expect(() => sut.generateKeysFromSeed(makeSeed()))
        .toThrow('crypto_box_seed_keypair failed with code -1');
    });

    it('WhenCalled_ShouldPassActualSeedBytesToSodium', () => {
      const capturedSeeds: number[][] = [];
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer, seed: ArrayBuffer) => {
          capturedSeeds.push(Array.from(new Uint8Array(seed)));
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );
      sut.generateKeysFromSeed(makeSeed(0xAB));
      expect(capturedSeeds[0][0]).toBe(0xAB);
      expect(capturedSeeds[0].length).toBe(32);
    });
  });

  // ── storePrivateKey ──────────────────────────────────────────────────────────

  describe('storePrivateKey', () => {
    it('WhenValidSeed_ShouldPersistToKeychainWithCorrectKey', async () => {
      const seed = makeSeed();
      await sut.storePrivateKey(seed, USER_ID);
      expect(mockedSetInternetCredentials).toHaveBeenCalledWith(
        keychainKey(USER_ID),
        USER_ID,
        seed,
        expect.any(Object)
      );
    });

    it('WhenValidSeed_ShouldUseAesGcmNoAuthStorage', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      expect(mockedSetInternetCredentials).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH })
      );
    });

    it('WhenValidSeed_ShouldMakeKeyCachedInMemory', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      expect(sut.getCachedKeys(USER_ID)).not.toBeNull();
    });

    it('WhenDifferentUsers_ShouldUseDistinctKeychainKeys', async () => {
      await sut.storePrivateKey(makeSeed(0x01), USER_ID);
      await sut.storePrivateKey(makeSeed(0x02), OTHER_USER_ID);
      const calls = mockedSetInternetCredentials.mock.calls;
      expect(calls[0][0]).toBe(keychainKey(USER_ID));
      expect(calls[1][0]).toBe(keychainKey(OTHER_USER_ID));
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });

    it('WhenEmptySeed_ShouldThrow', async () => {
      await expect(sut.storePrivateKey('', USER_ID))
        .rejects.toThrow('Private key storage failed');
    });

    it('WhenWhitespaceSeed_ShouldThrow', async () => {
      await expect(sut.storePrivateKey('   ', USER_ID))
        .rejects.toThrow('Private key storage failed');
    });

    it('WhenKeychainFails_ShouldThrow', async () => {
      mockedSetInternetCredentials.mockRejectedValue(new Error('Keychain locked'));
      await expect(sut.storePrivateKey(makeSeed(), USER_ID))
        .rejects.toThrow('Private key storage failed');
    });

    it('WhenKeychainFails_ShouldNotPopulateCache', async () => {
      mockedSetInternetCredentials.mockRejectedValue(new Error('Keychain locked'));
      try { await sut.storePrivateKey(makeSeed(), USER_ID); } catch {}
      expect(sut.getCachedKeys(USER_ID)).toBeNull();
    });

    it('WhenCalled_ShouldNotCallKeychainGetDuringStore', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      expect(mockedGetInternetCredentials).not.toHaveBeenCalled();
    });
  });

  // ── getPrivateKey ────────────────────────────────────────────────────────────

  describe('getPrivateKey', () => {
    it('WhenKeychainHasKey_ShouldReturnSeed', async () => {
      const seed = makeSeed();
      mockKeychainHasKey(USER_ID, seed);
      expect(await sut.getPrivateKey(USER_ID)).toBe(seed);
    });

    it('WhenKeychainIsEmpty_ShouldReturnNull', async () => {
      mockedGetInternetCredentials.mockResolvedValue(false);
      expect(await sut.getPrivateKey(USER_ID)).toBeNull();
    });

    it('WhenKeychainReturnsCredentialWithoutPassword_ShouldReturnNull', async () => {
      mockedGetInternetCredentials.mockResolvedValue({ username: USER_ID, password: '' });
      expect(await sut.getPrivateKey(USER_ID)).toBeNull();
    });

    it('WhenKeyCached_ShouldReturnFromCacheWithoutKeychainCall', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      mockedGetInternetCredentials.mockClear();

      await sut.getPrivateKey(USER_ID);
      expect(mockedGetInternetCredentials).not.toHaveBeenCalled();
    });

    it('WhenFetchedFromKeychain_ShouldPopulateCacheForNextCall', async () => {
      mockKeychainHasKey(USER_ID, makeSeed());
      await sut.getPrivateKey(USER_ID);
      mockedGetInternetCredentials.mockClear();

      await sut.getPrivateKey(USER_ID);
      expect(mockedGetInternetCredentials).not.toHaveBeenCalled();
    });

    it('WhenKeychainThrows_ShouldReturnNullWithoutThrowing', async () => {
      mockedGetInternetCredentials.mockRejectedValue(new Error('Hardware failure'));
      expect(await sut.getPrivateKey(USER_ID)).toBeNull();
    });

    it('WhenStoredSeedIsInvalid_ShouldReturnNullWithoutThrowing', async () => {
      // A 16-byte (corrupted) seed would make generateKeysFromSeed throw
      const corruptedSeed = Buffer.alloc(16, 0x42).toString('base64');
      mockKeychainHasKey(USER_ID, corruptedSeed);
      expect(await sut.getPrivateKey(USER_ID)).toBeNull();
    });
  });

  // ── getCachedKeys ────────────────────────────────────────────────────────────

  describe('getCachedKeys', () => {
    it('WhenNotCached_ShouldReturnNull', () => {
      expect(sut.getCachedKeys(USER_ID)).toBeNull();
    });

    it('WhenCached_ShouldReturnArrayBuffers', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      const result = sut.getCachedKeys(USER_ID);
      expect(result).not.toBeNull();
      expect(result!.publicKey).toBeInstanceOf(ArrayBuffer);
      expect(result!.secretKey).toBeInstanceOf(ArrayBuffer);
    });

    it('WhenCached_ShouldReturnPublicKeyOf32Bytes', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      expect(sut.getCachedKeys(USER_ID)!.publicKey.byteLength).toBe(32);
    });

    it('WhenCached_ShouldReturnSecretKeyOf64Bytes', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      expect(sut.getCachedKeys(USER_ID)!.secretKey.byteLength).toBe(64);
    });

    it('WhenCachedForOneUser_ShouldReturnNullForOtherUser', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      expect(sut.getCachedKeys(OTHER_USER_ID)).toBeNull();
    });
  });

  // ── clearPrivateKey ──────────────────────────────────────────────────────────

  describe('clearPrivateKey', () => {
    it('WhenCalled_ShouldRemoveFromKeychain', async () => {
      await sut.clearPrivateKey(USER_ID);
      expect(mockedResetInternetCredentials).toHaveBeenCalledWith({
        server: keychainKey(USER_ID),
      });
    });

    it('WhenCalled_ShouldRemoveFromMemoryCache', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      await sut.clearPrivateKey(USER_ID);
      expect(sut.getCachedKeys(USER_ID)).toBeNull();
    });

    it('WhenCalledForUserNotInCache_ShouldNotThrow', async () => {
      await expect(sut.clearPrivateKey('non-existent-user')).resolves.not.toThrow();
    });

    it('WhenKeychainFails_ShouldNotThrow', async () => {
      mockedResetInternetCredentials.mockRejectedValue(new Error('Keychain unavailable'));
      await expect(sut.clearPrivateKey(USER_ID)).resolves.not.toThrow();
    });

    it('WhenCalled_ShouldOnlyAffectSpecifiedUser', async () => {
      await sut.storePrivateKey(makeSeed(0x01), USER_ID);
      await sut.storePrivateKey(makeSeed(0x02), OTHER_USER_ID);
      await sut.clearPrivateKey(USER_ID);
      expect(sut.getCachedKeys(USER_ID)).toBeNull();
      expect(sut.getCachedKeys(OTHER_USER_ID)).not.toBeNull();
    });
  });

  // ── ensureKeysAreCached ──────────────────────────────────────────────────────

  describe('ensureKeysAreCached', () => {
    it('WhenAlreadyCached_ShouldNotCallKeychain', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      mockedGetInternetCredentials.mockClear();
      await sut.ensureKeysAreCached(USER_ID);
      expect(mockedGetInternetCredentials).not.toHaveBeenCalled();
    });

    it('WhenSeedProvided_ShouldCacheWithoutKeychainCall', async () => {
      await sut.ensureKeysAreCached(USER_ID, makeSeed());
      expect(mockedGetInternetCredentials).not.toHaveBeenCalled();
      expect(sut.getCachedKeys(USER_ID)).not.toBeNull();
    });

    it('WhenNoSeedAndNotCached_ShouldFetchFromKeychain', async () => {
      mockKeychainHasKey(USER_ID, makeSeed());
      await sut.ensureKeysAreCached(USER_ID);
      expect(mockedGetInternetCredentials).toHaveBeenCalled();
    });

    it('WhenNoSeedAvailableAnywhere_ShouldThrow', async () => {
      mockedGetInternetCredentials.mockResolvedValue(false);
      await expect(sut.ensureKeysAreCached(USER_ID))
        .rejects.toThrow(`No seed available for user ${USER_ID}`);
    });
  });

  // ── rotateKeys ───────────────────────────────────────────────────────────────

  describe('rotateKeys', () => {
    it('WhenCalled_ShouldReturnNewKeyPair', async () => {
      const result = await sut.rotateKeys(USER_ID);
      expect(result.publicKey).toBeTruthy();
      expect(result.privateKey).toBeTruthy();
    });

    it('WhenCalled_ShouldStoreNewKeyInKeychain', async () => {
      const result = await sut.rotateKeys(USER_ID);
      expect(mockedSetInternetCredentials).toHaveBeenCalledWith(
        keychainKey(USER_ID),
        USER_ID,
        result.privateKey,
        expect.any(Object)
      );
    });

    it('WhenCalled_ShouldUpdateCacheWithNewKey', async () => {
      await sut.storePrivateKey(makeSeed(0x01), USER_ID);
      const cachedBefore = sut.getCachedKeys(USER_ID)!;

      useDeterministicSodium();
      mockedRandombytesBuf.mockImplementation((buf: ArrayBuffer) => {
        new Uint8Array(buf).fill(0xFF); // Different seed
      });

      await sut.rotateKeys(USER_ID);
      const cachedAfter = sut.getCachedKeys(USER_ID)!;

      const pubBefore = Buffer.from(cachedBefore.publicKey).toString('hex');
      const pubAfter  = Buffer.from(cachedAfter.publicKey).toString('hex');
      expect(pubBefore).not.toBe(pubAfter);
    });

    it('WhenKeyGenerationFails_ShouldThrow', async () => {
      mockedCryptoBoxSeedKeypair.mockReturnValue(-1);
      await expect(sut.rotateKeys(USER_ID)).rejects.toThrow('Key rotation failed');
    });
  });

  // ── getPrivateKeySafe ────────────────────────────────────────────────────────

  describe('getPrivateKeySafe', () => {
    it('WhenKeyExists_ShouldReturnSeed', async () => {
      const seed = makeSeed();
      mockKeychainHasKey(USER_ID, seed);
      expect(await sut.getPrivateKeySafe(USER_ID)).toBe(seed);
    });

    it('WhenKeyMissing_ShouldReturnNull', async () => {
      expect(await sut.getPrivateKeySafe(USER_ID)).toBeNull();
    });

    it('WhenKeychainThrows_ShouldReturnNullWithoutThrowing', async () => {
      mockedGetInternetCredentials.mockRejectedValue(new Error('Corrupted keychain'));
      expect(await sut.getPrivateKeySafe(USER_ID)).toBeNull();
    });
  });

  // ── initializeForUser ────────────────────────────────────────────────────────

  describe('initializeForUser', () => {
    it('WhenExistingKeyInKeychain_ShouldLoadItIntoCach', async () => {
      const seed = makeSeed();
      mockKeychainHasKey(USER_ID, seed);
      await sut.initializeForUser(USER_ID);
      expect(sut.getCachedKeys(USER_ID)).not.toBeNull();
    });

    it('WhenExistingKeyInKeychain_ShouldNotGenerateNewKey', async () => {
      mockKeychainHasKey(USER_ID, makeSeed());
      await sut.initializeForUser(USER_ID);
      expect(mockedSetInternetCredentials).not.toHaveBeenCalled();
    });

    it('WhenNoExistingKey_ShouldGenerateAndStoreNewKey', async () => {
      mockedGetInternetCredentials.mockResolvedValue(false);
      await sut.initializeForUser(USER_ID);
      expect(mockedSetInternetCredentials).toHaveBeenCalledWith(
        keychainKey(USER_ID),
        USER_ID,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('WhenNoExistingKey_ShouldCacheTheGeneratedKey', async () => {
      mockedGetInternetCredentials.mockResolvedValue(false);
      await sut.initializeForUser(USER_ID);
      expect(sut.getCachedKeys(USER_ID)).not.toBeNull();
    });

    it('WhenSodiumInitFails_ShouldThrowAndClearState', async () => {
      mockedSodiumInit.mockReturnValue(-1);
      await expect(sut.initializeForUser(USER_ID))
        .rejects.toThrow('CryptoService initialization failed');
      expect(sut.getCachedKeys(USER_ID)).toBeNull();
    });

    it('WhenKeyDerivationFails_ShouldThrowAndClearPartialState', async () => {
      mockKeychainHasKey(USER_ID, makeSeed());
      mockedCryptoBoxSeedKeypair.mockReturnValue(-1);
      await expect(sut.initializeForUser(USER_ID))
        .rejects.toThrow('CryptoService initialization failed');
      expect(sut.getCachedKeys(USER_ID)).toBeNull();
    });
  });

  // ── Sodium package contract ───────────────────────────────────────────────────
  // These tests protect against breaking changes in @s77rt/react-native-sodium.
  // If a new package version changes constants, return value conventions, or
  // function signatures, these tests will fail and alert us before the bug reaches
  // production.

  describe('Sodium package contract', () => {
    it('PUBLICKEYBYTES_ConstantMustBe32', () => {
      expect(sodium.crypto_box_PUBLICKEYBYTES).toBe(32);
    });

    it('SECRETKEYBYTES_ConstantMustBe64', () => {
      expect(sodium.crypto_box_SECRETKEYBYTES).toBe(64);
    });

    it('SodiumInit_ZeroMeansSuccess', async () => {
      mockedSodiumInit.mockReturnValue(0);
      await expect(sut.generateKeyPair()).resolves.toBeDefined();
    });

    it('SodiumInit_NegativeMeansFailure', async () => {
      for (const code of [-1, -2, -100]) {
        (CryptoService as any).instance = undefined;
        sut = CryptoService.getInstance();
        mockedSodiumInit.mockReturnValue(code);
        await expect(sut.generateKeyPair()).rejects.toThrow();
      }
    });

    it('SodiumInit_PositiveNonZeroMeansSuccess', async () => {
      // sodium_init returns 1 if already initialized — must still proceed
      mockedSodiumInit.mockReturnValue(1);
      await expect(sut.generateKeyPair()).resolves.toBeDefined();
    });

    it('CryptoBoxSeedKeypair_ZeroReturnMeansSuccess', () => {
      mockedCryptoBoxSeedKeypair.mockReturnValue(0);
      expect(() => sut.generateKeysFromSeed(makeSeed())).not.toThrow();
    });

    it('CryptoBoxSeedKeypair_NonZeroReturnMeansFailure', () => {
      for (const code of [-1, 1, 99]) {
        mockedCryptoBoxSeedKeypair.mockReturnValue(code);
        expect(() => sut.generateKeysFromSeed(makeSeed()))
          .toThrow(`crypto_box_seed_keypair failed with code ${code}`);
        (CryptoService as any).instance = undefined;
        sut = CryptoService.getInstance();
      }
    });

    it('CryptoBoxSeedKeypair_MustReceiveExactly32ByteSeed', () => {
      let capturedSeedSize = 0;
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer, seed: ArrayBuffer) => {
          capturedSeedSize = seed.byteLength;
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );
      sut.generateKeysFromSeed(makeSeed());
      expect(capturedSeedSize).toBe(32);
    });

    it('CryptoBoxSeedKeypair_SeedContentMustBePassedUnmodified', () => {
      const capturedSeeds: number[][] = [];
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer, seed: ArrayBuffer) => {
          capturedSeeds.push(Array.from(new Uint8Array(seed)));
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );
      sut.generateKeysFromSeed(makeSeed(0xDE));
      sut.generateKeysFromSeed(makeSeed(0xAD));
      expect(capturedSeeds[0].every(b => b === 0xDE)).toBe(true);
      expect(capturedSeeds[1].every(b => b === 0xAD)).toBe(true);
    });

    it('RandombytesBuf_MustWriteIntoProvidedBuffer', async () => {
      let bufferFilledByRandom: Uint8Array | null = null;
      let bufferPassedToKeypair: Uint8Array | null = null;

      mockedRandombytesBuf.mockImplementation((buf: ArrayBuffer) => {
        new Uint8Array(buf).fill(0x77);
        bufferFilledByRandom = new Uint8Array(buf.slice(0));
      });
      mockedCryptoBoxSeedKeypair.mockImplementation(
        (pub: ArrayBuffer, sec: ArrayBuffer, seed: ArrayBuffer) => {
          bufferPassedToKeypair = new Uint8Array(seed.slice(0));
          new Uint8Array(pub).fill(0x01);
          new Uint8Array(sec).fill(0x02);
          return 0;
        }
      );

      await sut.generateKeyPair();

      // The bytes written by randombytes_buf must arrive at crypto_box_seed_keypair
      expect(Array.from(bufferPassedToKeypair!)).toEqual(Array.from(bufferFilledByRandom!));
    });

    it('KeychainServiceKey_MustEmbedUserId', async () => {
      await sut.storePrivateKey(makeSeed(), USER_ID);
      const usedKey = mockedSetInternetCredentials.mock.calls[0][0] as string;
      expect(usedKey).toContain(USER_ID);
    });

    it('KeychainServiceKey_TwoUsersMustGetDistinctKeys', async () => {
      await sut.storePrivateKey(makeSeed(0x01), USER_ID);
      await sut.storePrivateKey(makeSeed(0x02), OTHER_USER_ID);
      const key1 = mockedSetInternetCredentials.mock.calls[0][0];
      const key2 = mockedSetInternetCredentials.mock.calls[1][0];
      expect(key1).not.toBe(key2);
    });
  });
});
