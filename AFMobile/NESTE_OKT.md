# AFMobile — Neste økt

## Status ved slutt av forrige økt

### Ferdig disse øktene
- `react-hook-form` + `zod` — skjemavalidering installert og integrert
- Login migrert til rhf+zod (`useLogin`, `LoginScreen`, `schemas.ts`)
- `signUpService`, `verificationService`, `baseService` → Result-pattern + JSDoc
- `useRegisterUser` → fjernet try/catch, typed RegistrationErrorCode
- **Tema-system** — `react-native-unistyles` v3.1.1 (pinnet)
- **Globalisering** — `i18next` + `react-i18next` + `expo-localization`
- **Tokens lagres i Keychain** (ikke AsyncStorage), migrasjon fra AsyncStorage ved første oppstart
- **Komplett auth-flyt testet og fungerende:**
  - Signup → e-postverifisering → SMS-verifisering → Login → Home
  - Login med uverifisert e-post → VerificationScreen
  - Login med uverifisert telefon → PhoneSmsVerificationScreen
  - Login med feil credentials → feilmelding
- **PhoneSmsVerificationScreen** — ny skjerm, samme tema som VerificationScreen
- **SMS-endepunkter bruker email** (ikke phoneNumber) — backend slår opp internt
- **Signup telefonnummer** — landskode-picker (pill) med auto-forslag fra valgt land
- **userId er string (GUID)** — `AuthContext`, `getUserIdFromToken` returnerer string, ikke number
- **`baseService.parseJsonIfPresent`** — håndterer void-endepunkter med tom body
- **Zod-schemas** matcher Identity-regler i AFBack (min 8 tegn)
- **AppErrorCode-system** — delt domenekode mellom AFBack og AFMobile
- **ResetPasswordScreen** migrert til rhf+zod
- **PasswordFieldNative** konsolidert til én felles komponent
- **Login MFA-flyt implementert (backend + frontend):**
  - `LoginAsync` i `AuthService` splittet — steg 1 sender MFA-kode på e-post, returnerer `200 OK`
  - `VerifyMfaAsync` — steg 2 verifiserer kode og utsteder tokens
  - `VerificationInfo` utvidet med `LoginMfaCode`-slot
  - `GenerateLoginMfaCodeAsync` + `ValidateLoginMfaCodeAsync` i `VerificationInfoService`
  - `ValidateSecurityAlertTokenAsync` nullstiller også MFA-koden (nødbremsen)
  - `POST /api/auth/login/verify-mfa` — nytt endepunkt i `AuthController`
  - `AppErrorCode.MfaRequired = 2006` lagt til (backend + shared + frontend)
  - `AuthErrorCode.MfaRequired` lagt til i frontend
  - `authServiceNative.login` returnerer nå `void` (ingen tokens i steg 1)
  - `authServiceNative.verifyMfa` — ny metode, lagrer tokens i Keychain
  - `loginUser` og `verifyMfaCode` i `authService.ts` — to separate funksjoner
  - `useLogin` navigerer til `LoginMfaScreen` ved `200 OK`
  - `LoginMfaScreen` + `useLoginMfa` — ny skjerm og hook
  - `ApiRoutes.auth.verifyMfa` lagt til
  - `DeviceInfoRequest`-import i `authServiceNative` rettet til `@/core/models/DeviceInfoRequest`
  - i18n-nøkler for MFA lagt til (no + en)
  - `LoginMfaScreen` registrert i `App.tsx` og `navigation.ts`
  - `docs/auth/login.md` og `docs/auth/login-mfa.md` oppdatert

- **E2EE-nøkkeloppsett etter login — implementert og testet:**
  - `POST /api/encryption/keys` — nytt kombinert endepunkt i `EncryptionController`
  - `StoreEncryptionKeysAsync` — lagrer public key i DB + recovery seed i Key Vault atomisk
  - `StoreEncryptionKeyRequest` — `PublicKey` + `RecoverySeed`, begge 44 tegn (32 bytes X25519)
  - `UserKeyVersion`-entitet planlagt men ikke migrert ennå
  - `E2EESetupScreen` + `useE2EESetup` — ny skjerm og hook
  - `encryptionService.ts` — `getMyPublicKey` + `storeEncryptionKeys`
  - `E2EESetupErrorCode` lagt til i `ErrorCode.ts`
  - `ApiRoutes.encryption` lagt til
  - `useLoginMfa` navigerer til `E2EESetupScreen` i stedet for direkte `login()`
  - `E2EESetupScreen` registrert i uautentisert stack i `App.tsx`
  - i18n-nøkler for E2EE lagt til (no + en)
  - **Scenario A (ny bruker) testet og fungerer** — nøkkel genereres, lagres lokalt og på server
  - **Scenario B (eksisterende enhet)** — ikke testet ennå
  - **Scenario C (ny enhet, eksisterende nøkkel)** — ikke testet ennå
  - Key Vault feiler (connection refused) — ikke satt opp ennå

### Auth-flyt — teststatus
- ✅ Signup — fungerer
- ✅ E-post verifisering — navigerer til PhoneSmsVerificationScreen
- ✅ SMS verifisering — navigerer til Login med `fromVerification: true`-banner
- ✅ Login med verifisert konto — navigerer til LoginMfaScreen
- ✅ Login med uverifisert e-post — navigerer til VerificationScreen
- ✅ Login med uverifisert telefon — navigerer til PhoneSmsVerificationScreen
- ✅ Login med feil credentials — viser feilmelding via toast
- ✅ Login MFA — fungerer
- ✅ E2EE Scenario A (ny bruker, ingen nøkkel) — fungerer (Key Vault feiler, men flyt OK)
- ⏳ E2EE Scenario B (eksisterende enhet med lokal nøkkel) — ikke testet
- ⏳ E2EE Scenario C (ny enhet, server har nøkkel) — ikke testet
- ⏳ Logout — ikke testet
- ⏳ Reset password — ikke testet

---

## Gjøremål neste økt — i rekkefølge

### ✅ Steg 1 — Sett opp UpCloud Key Vault
- Terraform-infrastruktur deployet — Vault-server på `185.26.50.194`
- HashiCorp Vault installert, initialisert og unsealet
- KV v2 aktivert på path `af/`
- Vault-token lagret i dotnet user-secrets (`KeyVault:Token`)
- `POST /api/encryption/keys` testet — recovery seed lagres i Vault ✅
- Scenario A end-to-end fungerer ✅
- E2EESetupScreen retry-knapp lagt til for feil under Scenario A

### ✅ Steg 0 (ekstra) — OptionExtensions-refaktorering i AFBack
- Alle appsettings-seksjoner migrert til typesterke Options-klasser med `[Required]` og `ValidateOnStart`
- `IConfiguration` fjernet fra alle services — erstattet med `IOptions<T>`
- Berørte filer: `UpCloudBuilderExtensions`, `ServiceCollectionExtensions`, `WebApplicationBuilderExtensions`,
  `SmsService`, `UserReportService`, `SupportTicketService`, `UserSummaryCacheService`, `CanSendCache`,
  `S3UrlBuilder`, `AccountVerificationService`

### Steg 2 — Oppdater CryptoService og CryptoServiceBackup
Disse er legacy-kode som ikke er i sync med ny arkitektur:
- `CryptoService.userId` er `number` overalt — skal være `string` (GUID)
  - `storePrivateKey(seed, userId: number)` → `storePrivateKey(seed, userId: string)`
  - `getPrivateKey(userId: number)` → `getPrivateKey(userId: string)`
  - `getPrivateKeySafe(userId: number)` → `getPrivateKeySafe(userId: string)`
  - `ensureKeysAreCached`, `clearPrivateKey`, `rotateKeys` — samme endring
- `CryptoServiceBackup` importerer gammel `@/services/crypto/cryptoService` (storePublicKey, storeRecoverySeed separat)
  - Oppdater til å bruke ny `encryptionService.ts` (`storeEncryptionKeys`)
- Verifiser at `CryptationScreen` (innstillingssiden) fortsatt fungerer etter endringene

### Steg 3 — Bootstrap-gjennomgang
- `AppInitializer` / bootstrap-flyten kjøres etter `login()` — sjekk at E2EE-oppsett ikke kolliderer
- Sekundær bootstrap henter samtaler med krypterte meldinger — verifiser at nøkkel er klar før bootstrap forsøker å dekryptere
- Vurder om `CryptoService.initializeForUser` skal kalles i bootstrap eller i `useE2EESetup`

### Steg 4 — Test gjenstående scenarioer
- **Scenario B** — logg inn på samme enhet igjen, verifiser at E2EESetupScreen passerer gjennom uten UI
- **Scenario C** — avinstaller app, logg inn på nytt, skriv inn backup-phrase
- **Logout** — logg ut, sjekk at tokens slettes fra Keychain og at appen navigerer til Login
- **Reset password** — test hele den nye 4-stegs flyten

### Steg 5 — EmailTemplates.LoginMfa
Opprett `EmailTemplates.LoginMfa(EmailCodeDto)` i AFBack — basert på `EmailTemplates.Verification`.
Bruk samme layout, men med tekst som reflekterer at dette er en innloggingskode, ikke en kontobekreftelse.

### Steg 6c — Gjenstående backend-opprydding
1. **CancellationToken + transaksjoner** — gå gjennom alle services i AFBack:
   - `TokenService.RevokeTokenAsync` og `RevokeAllTokensForUserAsync` — mangler transaksjon
   - `AuthService.ReportUnauthorizedChangeAsync` — flere `UpdateAsync`-kall uten transaksjon
   - `LoginHistoryService`, `UserDeviceService` — sjekk om de mangler `ct`-parametere

### Steg 7 — Tema-gjennomgang av gjenværende skjermer
- `CryptationScreen` — massivt avvik: hardkodede farger, ingen useUnistyles, ingen i18n, deprecated Clipboard, ingen Result-pattern
- Alle komponenter i `components/common/` som ikke er migrert ennå

### Steg 8 — Migrer features/messages/ til Feature Slice-arkitektur — VENT MED DENNE

### Steg 9 — Over-engineering og oppryddingsgjennomgang

**Kandidat 1 — `useConversationUpdate` er en unødvendig wrapper**
**Kandidat 3 — `useGetDeletedConversations` og `useGetRejectedConversations` er identiske**
**Kandidat 4 — `useMessageNotifications` har `loading` i dependency-array**
**Kandidat 5 — `useBootstrap` eksponerer for mye data**

### Steg 10 (fremtidig) — Push-varsler

---

## Hurtigreferanse — all installert infrastruktur

### Tema
```tsx
const { theme } = useUnistyles();
color: theme.colors.primary          // gull (#D4A017) i begge temaer
backgroundColor: theme.colors.background
// ALDRI: hardkodede farger
```

### AppErrorCode / API-feil
```typescript
import { throwProblemDetails, ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

if (error instanceof ApiError) {
  switch (error.appCode) {
    case AppErrorCode.EmailNotConfirmed: ...  // 2002
    case AppErrorCode.PhoneNotConfirmed: ...  // 2003
    case AppErrorCode.InvalidCredentials: ... // 2000
    case AppErrorCode.MfaRequired: ...        // 2006
    case AppErrorCode.TooManyRequests: ...    // 1006
    case AppErrorCode.InvalidCode: ...        // 4000
    case AppErrorCode.ExpiredCode: ...        // 4001
  }
}
```

### Result-pattern
```tsx
const result = await loginUser(email, password);
if (!result.success) {
  switch (result.code) {
    case AuthErrorCode.InvalidCredentials: ...
    case AuthErrorCode.EmailNotVerified: ...
    case AuthErrorCode.PhoneNotVerified: ...
    case AuthErrorCode.MfaRequired: ...
  }
  return;
}
```

### E2EE-nøkkelflyt
```
Login → MFA → E2EESetupScreen
  Scenario A (ingen nøkkel noe sted):   generer → storeEncryptionKeys → login()
  Scenario B (server + lokal nøkkel):   ingen handling → login()
  Scenario C (server-nøkkel, ingen lokal): vis UI → restore/ny nøkkel → login()

POST /api/encryption/keys { publicKey, recoverySeed }  ← alltid ved ny eller rotert nøkkel
GET  /api/encryption/public-key                        ← sjekk om server har nøkkel (404 = ingen)
```

### Globalisering
```tsx
const { t } = useTranslation();
t("auth.login")
t("e2ee.restoreTitle")
// ALDRI: hardkodet tekst
```

### Datoformatering
```tsx
import { format, formatDistanceToNow, isToday } from "date-fns";
import { nb, enUS } from "date-fns/locale";
const locale = language === "no" ? nb : enUS;
format(date, "HH:mm", { locale })
```

### Tidformatering (nedtelling)
```tsx
import { formatTime } from "@/utils/formatTime";
formatTime(90) // → "1:30"
```

### Lister
```tsx
import { FlashList } from "@shopify/flash-list";
<FlashList data={items} renderItem={({ item }) => <Item data={item} />} keyExtractor={(item) => item.id} />
```

### Kjøre lokalt
```bash
# Backend
cd C:\Users\fredr\ActivityFinder\AFBack && dotnet run

# Frontend (JS-endringer)
cd C:\Users\fredr\ActivityFinder\AFMobile && npx expo start --clear

# Frontend (ny native pakke installert)
npx expo run:android
```
