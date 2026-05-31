# AFMobile — Kjøre appen

## Koble til telefon

```bash
adb reverse tcp:8081 tcp:8081
```

## Start appen

```bash
# Vanlig utvikling (JS/TS-endringer)
npx expo start --clear

# Ny native pakke installert (sjeldent, tar 10–15 min)
npx expo run:android
```

> Appen bruker **expo-dev-client** — kan ikke åpnes i Expo Go.

## Feilsøking

```bash
# Signaturkonflikt (appen krasjer ved installasjon)
adb uninstall com.dadrikthedad.AFMobile
```

---

## Tester

```bash
# Kjør alle tester
npm test

# Kjør spesifikk test-fil
npm test -- CryptoService

# Watch-modus — kjører på nytt automatisk ved lagring
npm run test:watch

# Med dekningsrapport
npm run test:coverage
```

### Testrammeverk

**Jest 29 + jest-expo 53 + @testing-library/react-native**

Test-filer ligger i `__tests__/`-mapper rett ved siden av kildefilene:

```
components/ende-til-ende/
├── CryptoService.ts
└── __tests__/
    └── CryptoService.test.ts
```

### Mock-filer

| Fil | Hva den mocker |
|-----|---------------|
| `__mocks__/@s77rt/react-native-sodium.ts` | X25519-kryptografi (native) |
| `__mocks__/react-native-keychain.ts` | Keychain-lagring (native) |
| `core/auth/__mocks__/authServiceNative.ts` | Auth-service |

Se `AFMobile/.claude/rules/testing.md` for detaljerte test-regler og mønstre.
