# Testing-regler — AFMobile

## Framework

**Jest 29 + jest-expo 53 + @testing-library/react-native**

```bash
npm test                        # Kjør alle tester én gang
npm test -- CryptoService       # Kjør spesifikk test-fil
npm run test:watch              # Watch-modus — kjører på nytt ved lagring
npm run test:coverage           # Med dekningsrapport
```

## Konfigurasjon

- `jest.config.js` — preset, timeouts, moduleNameMapper, transformIgnorePatterns
- `jest.setup.js` — global oppsett (tomt for nå, klar for fremtidig bruk)
- `__mocks__/@s77rt/react-native-sodium.ts` — mock av sodium-biblioteket
- `__mocks__/react-native-keychain.ts` — mock av Keychain-lagring
- `core/auth/__mocks__/authServiceNative.ts` — mock av auth-service

## Teststruktur — co-lokalisert med kildefilen

```
components/ende-til-ende/
├── CryptoService.ts
└── __tests__/
    └── CryptoService.test.ts

features/auth/
├── hooks/
│   ├── useE2EESetup.ts
│   └── __tests__/
│       └── useE2EESetup.test.ts
└── services/
    ├── encryptionService.ts
    └── __tests__/
        └── encryptionService.test.ts
```

## Test-navnekonvensjon

```typescript
describe('CryptoService', () => {
  describe('generateKeyPair', () => {
    it('WhenCalled_ShouldReturnBase64PublicKey', ...)
    it('WhenSodiumInitFails_ShouldThrow', ...)
  });
});
```

## Mønster — Arrange/Act/Assert

```typescript
it('WhenValidSeed_ShouldPersistToKeychain', async () => {
  // Arrange
  const seed = makeSeed();

  // Act
  await sut.storePrivateKey(seed, USER_ID);

  // Assert
  expect(mockedSetInternetCredentials).toHaveBeenCalledWith(
    'e2ee_private_key_user-guid',
    USER_ID,
    seed,
    expect.any(Object)
  );
});
```

## Native modul-mocking

Native moduler (sodium, keychain) kan ikke kjøre i Node.js/Jest.
Mockene ligger i `__mocks__/` og aktiveres automatisk via `jest.mock('pakkenavn')`.

```typescript
// I test-filen øverst:
jest.mock('react-native-keychain');
jest.mock('@s77rt/react-native-sodium');
jest.mock('@/core/auth/authServiceNative');

// Typed referanse for enklere bruk:
const mockedSetInternetCredentials = Keychain.setInternetCredentials as jest.Mock;
```

## Singleton-reset mellom tester

`CryptoService` er en singleton. Reset instansen i `beforeEach` for isolasjon:

```typescript
beforeEach(() => {
  (CryptoService as any).instance = undefined;
  sut = CryptoService.getInstance();
});
```

## Mock-reset i beforeEach

Bruk `mockReset().mockReturnValue(...)` for å rydde kall-historikk OG sette ny standardverdi:

```typescript
beforeEach(() => {
  mockedSodiumInit.mockReset().mockReturnValue(0);
  mockedGetInternetCredentials.mockReset().mockResolvedValue(false);
  
  // authServiceNative krever jest.requireMock (module-level mock):
  const { default: authMock } = jest.requireMock('@/core/auth/authServiceNative');
  (authMock.getCurrentUserId as jest.Mock).mockReset().mockResolvedValue(null);
});
```

## Hjelpefunksjon — seed-generering

```typescript
// Lager en gyldig 32-byte seed som base64. Ulik fill-verdi gir unike seeds.
const makeSeed = (fill = 0x42): string => Buffer.alloc(32, fill).toString('base64');
```

## Sodium-kontrakt-tester

`components/ende-til-ende/__tests__/CryptoService.test.ts` inneholder en egen
`describe('Sodium package contract')` som tester at biblioteket oppfører seg
som forventet (konstanter, returverdier, kall-signaturer). Disse testene fanger
breaking changes i `@s77rt/react-native-sodium` ved fremtidige versjonsoppdateringer.

## Eksisterende tester

| Fil | Tester | Dekker |
|-----|--------|--------|
| `components/ende-til-ende/__tests__/CryptoService.test.ts` | 79 | generateKeyPair, generateKeysFromSeed, storePrivateKey, getPrivateKey, getCachedKeys, clearPrivateKey, ensureKeysAreCached, rotateKeys, getPrivateKeySafe, initializeForUser, Sodium-kontrakt |

## Neste tester å skrive — prioritert

| Prioritet | Fil | Scenarioer |
|-----------|-----|-----------|
| 1 | `features/auth/services/encryptionService.test.ts` | getMyPublicKey (404→fail, 200→ok), storeEncryptionKeys |
| 2 | `features/auth/hooks/useE2EESetup.test.ts` | Scenario A (ny nøkkel), B (passerer gjennom), C (restore) |
| 3 | `features/auth/services/authService.test.ts` | loginUser (Result-mapping, AppErrorCode) |
| 4 | `features/auth/hooks/useLogin.test.ts` | rhf+zod validering, navigasjon ved feil |
