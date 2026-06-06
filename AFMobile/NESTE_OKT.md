# AFMobile — Neste økt

### Neste økt — Bootstrap-migrering til nye endepunkter

Deretter migreres bootstrap-flyten:
1. Les gjennom `services/bootstrap/` og kartlegg hvilke API-kall som gjøres i dag
2. Sammenlign mot nye endepunkter i AFBack (`BootstrapController`)
3. Oppdater kall ett for ett — hold E2EE-initialiseringen intakt (nøkkel må være i minnet før dekryptering starter)
4. Test full flyt: login → MFA → E2EESetupScreen → bootstrap → meldinger dekryptert

## Gjøremål neste økt — i rekkefølge

### Steg 3 — Test at bootstrap fungerer end-to-end

Bootstrap-endepunkter, DTOer og stores er oppdatert til å matche backend. Start med:
1. Start backend (`dotnet run` i AFBack)
2. Verifiser critical bootstrap: `user` (UserBootstrapDTO), `profile`, `settings`, `blockedUsers` populeres i `useUserCacheStore`
3. Verifiser secondary bootstrap: `activeConversations`, `pendingConversations`, `messageNotifications`, `unreadConversationIds` populeres i storene
4. Gå videre til SignalR — det var allerede `WRN: Mangler eller ugyldig bruker-ID ved tilkobling` i loggen

#### Hva som ble gjort denne økten (bootstrap-migrering)

**Backend:**
- `IBootstrapService` manglede DI-registrering — lagt til i `ServiceRegistrationExtensions.cs`
- `BootstrapService` injiserte konkrete typer — fikset til `IGetConversationsService` / `IMessageQueryService`
- `Task.WhenAll` krasjet fordi scoped DbContext ikke er thread-safe — løst med `IServiceScopeFactory` + `RunInScopeAsync` (hver parallell task får egen scope/DbContext)

**Frontend DTOer (`shared/types`):**
- Nye filer: `UserBootstrapDTO.ts` (id: string GUID), `UserProfileDTO.ts`, `BlockedUserDTO.ts`
- `UserSettingsDTO.ts` — fikset skrivefeil, lagt til `showAge`/`showBirthday`/`showBio`, alle felt required
- `ConversationDTO.ts` — `isGroup` → `type: ConversationType` enum, participant fikset (`conversationStatus→status`, lagt til `role`, `pendingMessagesReceived`)
- `CriticalBootstrapResponseDTO.ts` — ny shape: `user/profile/settings/blockedUsers`, fjernet `syncToken`
- `SecondaryBootstrapResponseDTO.ts` — ny shape: `activeConversations/pendingConversations/messageNotifications/unreadMessageNotificationCount`, fjernet felt som ikke finnes i backend
- `MessageNotificationDTO.ts` — lagt til `senderUserDto: UserSummaryDTO` og `summary`

**Stores:**
- `useUserCacheStore` — `currentUser: UserBootstrapDTO`, lagt til `profile`/`blockedUsers`, migrert til v2
- `useConversationStore` — `pendingMessageRequests` → `pendingConversations: ConversationDTO[]`, migrert til v2
- `useBootstrapDistributor` — bruker riktige feltnavn, distribuerer profile/blockedUsers, fjernet dead references

**Åpne punkter å ha i bakhodet:**
- `syncToken` settes ikke lenger fra critical bootstrap — sync-mekanismen håndterer dette separat
- `UserSummaryDTO.id` er fortsatt `number`, backend er GUID string — migreres i Steg 8
- Ikke-refaktorerte filer som bruker `isGroup`, `conversationStatus`, `pendingMessageRequests` vil ha TS-feil

### Steg 4 — Test gjenstående scenarioer (manuelt i appen)
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
  - Kaller også `cryptoBackupService.initializeForUser(user.userId)` på mount — sjekk userId-typen her
  - `rotateKeys` fra `useE2EE` er ikke koblet til noen skjerm ennå — kobles til her
- Alle komponenter i `components/common/` som ikke er migrert ennå

### Steg 4b — Skriv flere enhetstester
Infrastrukturen er på plass (jest 29 + jest-expo 53, 79 tester for CryptoService).
Neste tester å skrive — i prioritert rekkefølge:
1. `features/auth/services/__tests__/encryptionService.test.ts` — getMyPublicKey (404→fail, 200→ok), storeEncryptionKeys
2. `features/auth/hooks/__tests__/useE2EESetup.test.ts` — Scenario A, B og C
3. `features/auth/services/__tests__/authService.test.ts` — loginUser Result-mapping
4. `features/auth/hooks/__tests__/useLogin.test.ts` — rhf+zod validering og navigasjon

Se `AFMobile/.claude/rules/testing.md` for mønstre og oppsett.

### Steg 8 — Migrer features/messages/ til Feature Slice-arkitektur — VENT MED DENNE
Når denne gjøres: migrer `services/crypto/cryptoService.ts` til `features/crypto/services/` som del av samme jobb.
`getPublicKeysForUsers` bruker `number[]` for userId — skal bli `string[]` (GUID) i den migreringen.

### Steg 9 — Over-engineering og oppryddingsgjennomgang

**Kandidat 1 — `useConversationUpdate` er en unødvendig wrapper**
**Kandidat 3 — `useGetDeletedConversations` og `useGetRejectedConversations` er identiske**
**Kandidat 4 — `useMessageNotifications` har `loading` i dependency-array**
**Kandidat 5 — `useBootstrap` eksponerer for mye data**

### Steg 10 (fremtidig) — Push-varsler

---

## Viktig teknisk info fra denne økten

### MigrateAsync ved oppstart — lagt til i Program.cs
`app.MigrateDatabaseAsync()` kjøres automatisk i `WebApplicationExtensions` etter `UseAppPipeline()`.
Migrasjoner kjøres nå ved oppstart i alle miljøer (produksjon, UpCloud, tester) — `dotnet ef database update` er ikke lenger nødvendig manuelt.
`BackendApplicationFactory` drar nytte av dette automatisk — race condition mellom `IpBanService` og tabellopprettelse er eliminert.

### SearchRepository — bugfix i SearchUsersAsync
`OrderBy(x => x.ProximityLevel)` etter `.Select()` til prosjektert POCO krasjer i EF Core/Npgsql.
Fikset ved å flytte `.Select()` til etter `.OrderBy().Take()`.
`ProximityLevel` er ikke implementert ennå (alltid 0) — cursor degraderer til `fullName|userId`-sortering.

---

## Gjort forrige økten ✅

- Login og logout testet og fungerer i appen
- `MobilNavbarNative.tsx` migrert til `useUnistyles` + `t()` — ingen hardkodede farger eller tekst
- Logout-timeout fikset: `markOfflineWithDefaults()` wrappet med `Promise.race` (3 sek) — logger ut selv om backend er nede
- 18 filer migrert fra `@/services/user/authServiceNative` → `@/core/auth/authServiceNative`
- 5 deprecated shim-filer slettet (`services/user/authService.ts`, `authServiceNative.ts`, `signUpService.ts`, `services/security/verificationService.ts`, `hooks/useRegisterUser.ts`)

---

## Viktig teknisk info fra fullførte steg

### Auth-flyt — teststatus
- Signup — fungerer
- E-post verifisering — navigerer til PhoneSmsVerificationScreen
- SMS verifisering — navigerer til Login med `fromVerification: true`-banner
- Login med verifisert konto — navigerer til LoginMfaScreen
- Login med uverifisert e-post — navigerer til VerificationScreen
- Login med uverifisert telefon — navigerer til PhoneSmsVerificationScreen
- Login med feil credentials — viser feilmelding via toast
- Login MFA — fungerer
- E2EE Scenario A (ny bruker, ingen nøkkel) — fungerer
- E2EE Scenario B (eksisterende enhet med lokal nøkkel) — ikke testet
- E2EE Scenario C (ny enhet, server har nøkkel) — ikke testet
- Logout — ikke testet
- Reset password — ikke testet

### Bootstrap + E2EE — flyten er korrekt
- `AppInitializerNative` blokkerer bootstrap til `e2eeInitialized = true`
- `CryptoInitializer` laster nøkkel fra Keychain inn i `CryptoService`-cache via `CryptoServiceBackup.initializeForUser`
- Nøkkelen er i minnet før sekundær bootstrap dekrypterer meldinger
- `CryptoService.initializeForUser` skal IKKE kalles i bootstrap — cachen fylles allerede av `CryptoInitializer`

### `UserSummaryDTO.id` er fortsatt `number`
Ikke migrert til GUID ennå. Midlertidig workaround i `useE2EE.rotateKeys`: `currentUser.id.toString()`.
Migreres som del av Steg 8 (meldinger).

### E2EE-nøkkelflyt
```
Login → MFA → E2EESetupScreen
  Scenario A (ingen nøkkel noe sted):   generer → storeEncryptionKeys → login()
  Scenario B (server + lokal nøkkel):   ingen handling → login()
  Scenario C (server-nøkkel, ingen lokal): vis UI → restore/ny nøkkel → login()

POST /api/encryption/keys { publicKey, recoverySeed }  ← alltid ved ny eller rotert nøkkel
GET  /api/encryption/public-key                        ← sjekk om server har nøkkel (404 = ingen)
```

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
