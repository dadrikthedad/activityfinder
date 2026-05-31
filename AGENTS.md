# ActivityFinder — Agent Instructions

Ende-til-ende kryptert meldingsapp. React Native (Expo) + .NET 10 + PostgreSQL + Redis.

## Prosjektstruktur

```
ActivityFinder/
├── AFBack/         # .NET 10 backend API
├── AFBack.Tests/   # xUnit-tester
├── AFMobile/       # React Native / Expo mobilapp
├── shared/         # Delte TypeScript-typer (frontend/mobile)
└── activitynext/   # Next.js webfront (ikke aktiv)
```

## Bygg og kjør

```bash
# Backend
cd AFBack
dotnet run
dotnet watch run
dotnet ef migrations add <Navn>
dotnet ef database update

# Tester
dotnet test
dotnet test --filter "FullyQualifiedName~Auth"
dotnet watch test

# Mobilapp
cd AFMobile
npx expo run:android        # Kreves ved nye native pakker
npx expo start --clear      # Tilstrekkelig for JS/TS-endringer
adb reverse tcp:8081 tcp:8081

# Mobilapp — tester
npm test                    # Kjør alle tester
npm test -- CryptoService   # Kjør spesifikk test-fil
npm run test:watch          # Watch-modus
npm run test:coverage       # Med dekningsrapport
```

## Kritiske regler

**Krypteringsgrense:** Backend lagrer KUN kryptert data. Dekrypter ALDRI i backend.

**Modeller:** ALDRI opprett nye modeller eller legg til egenskaper uten eksplisitt bekreftelse fra Magee.

**Transaksjonsmønster:** Commit database FØRST, deretter SignalR, deretter SyncEvents.

**Cache-invalidering:** Invalider `CanSend`-cache ved accept, block, archive og leave.

## Kodestil

- **Kommentarer:** Norsk. **Identifikatorer og API-navn:** Engelsk.
- **Fil-organisering:** Én ting per fil.
- **Arkitektur backend:** Vertical Slice — `Features/[Feature]/Controller + Service + Repository + DTOs/`
- **Arkitektur mobil:** Feature Slice — `features/[feature]/screens + hooks + services + models/`
- **Emojier:** Aldri bruk emojier i kode, kommentarer, filer eller svar.

## Feilhåndtering

Backend returnerer alltid `AppProblemDetails` med `code`-felt (int) ved domenefeil:

```json
{ "status": 401, "title": "Authentication Error", "detail": "...", "code": 2002 }
```

- Backend: `Result<T>` med `AppErrorCode` → `HandleFailure()` i `BaseController`
- Frontend: `error.appCode` (ikke `error.status`) i alle `mapXxxError`-funksjoner
- `AppErrorCode`-enumen i `shared/types/error/AppErrorCode.ts` er kontrakten — hold den synkronisert med `AFBack`

## Testing

**Framework:** xUnit + Moq + FluentAssertions. InMemoryDatabase med `Guid.NewGuid().ToString()` for isolasjon.

```csharp
[Fact]
public async Task Method_WhenCondition_ShouldExpectedBehavior()
{
    // Arrange / Act / Assert
}
```

## Sikkerhet

- Passord: Argon2id med `FixedTimeEquals`
- Tokens: JWT HS256 (15 min) + opakt refresh token (365 dager) med rotation og reuse detection
- Access token blacklisting i Redis ved logout
- Refresh token bundet til `DeviceFingerprint`
- `DummyUser` for konstant responstid ved ukjent epost

## Mobilapp — viktige gotchas

- Tokens lagres i Keychain via `authServiceNative` — **aldri** AsyncStorage
- Tema: alltid `theme.colors.*` fra `useUnistyles()` — aldri hardkodede farger
- Globalisering: alltid `t("nøkkel")` fra `useTranslation()` — aldri hardkodede strenger
- `userId` er string (GUID), ikke number
- Void-endepunkter returnerer tom body — bruk `postRequestPublic<void, ...>`
- `react-native-unistyles` og `react-native-nitro-modules` er pinnet — ikke oppdater uten å sjekke kompatibilitetstabellen

## Mer detaljert dokumentasjon

- Backend: `AFBack/CLAUDE.md`
- Mobilapp: `AFMobile/CLAUDE.md`
- Testing backend: `AFBack/.claude/rules/testing.md`
- Testing mobilapp: `AFMobile/.claude/rules/testing.md`
