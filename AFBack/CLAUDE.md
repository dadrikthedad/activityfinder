# AFBack Backend

.NET 10 API for ende-til-ende kryptert meldingsapp. PostgreSQL + Redis + SignalR.

## Hurtigstart

```bash
dotnet run                              # Dev
dotnet watch run                        # Hot reload
dotnet ef migrations add Name           # Migration
dotnet ef database update               # Kjør migration
dotnet test                             # Alle tester
dotnet test --filter "FullyQualifiedName~Auth"  # Auth-tester
```

## Arkitektur: Vertical Slice

```
Features/[Feature]/
  ├── [Feature]Controller.cs   # API endpoints
  ├── [Feature]Service.cs      # Forretningslogikk
  ├── [Feature]Repository.cs   # Datahåndtering
  └── DTOs/                    # Request/Response
```

## Auth-system

### Token-modell

| Token | Levetid | Lagring | Formål |
|-------|---------|---------|--------|
| Access Token (JWT HS256) | 15 min | Kun klient | Autentisering av API-kall |
| Refresh Token (opak, 64 bytes) | 365 dager | PostgreSQL + klient | Fornye access token |

### Login-flyt

```
POST /api/auth/login
1. Rate limit-sjekk
2. Finn bruker (DummyUser for timing-beskyttelse)
3. Lockout-sjekk (5 feil → 5 min lockout)
4. Argon2id passord-validering
5. Epost/telefon-verifisering-sjekk
6. Resolve/opprett UserDevice
7. Generer AccessToken + RefreshToken
8. Logg LoginHistory
```

### Token Refresh (rotation)

```
POST /api/token/refresh
1. Finn refresh token i DB
2. Revokert? → Revoker ALLE tokens (token-tyveri), returner feil
3. Utløpt? → Returner feil
4. DeviceFingerprint mismatch? → Returner feil
5. Revoker gammelt token, generer nytt par
```

### Sikkerhetsmekanismer

- **Argon2id** (128 MB, 4 iterasjoner, 4 parallelle) med `FixedTimeEquals`
- **Redis blacklisting** av access token JTI ved logout (TTL = gjenværende levetid + 30 sek)
- **Token reuse detection** — revokert refresh token trigger full session-invalidering
- **Device binding** — refresh token er bundet til DeviceFingerprint
- **DummyUser** ved ukjent epost for lik responstid (timing-beskyttelse)
- **Lockout** — 5 feil → 5 min lockout → SuspiciousActivity-rapportering

### JWT Claims

`sub` (UserId), `email`, `jti` (for blacklisting), `device_id`, `role`, `exp`

Claim-mapping er slått av (`DefaultInboundClaimTypeMap.Clear()`).
`ConfigureJwtBearerOptions` setter `RoleClaimType = "role"` og `NameClaimType = Sub`.

### Endepunkter

| Metode | Rute | Auth |
|--------|------|------|
| POST | `/api/auth/login` | Anonym |
| POST | `/api/token/refresh` | Anonym |
| POST | `/api/auth/logout` | Autentisert |
| POST | `/api/auth/logout-all` | Autentisert |

## Forretningslogikk

### SendMessageToUser-flyt

**Hot path (eksisterende samtale):**
1. Sjekk om sender er pending → auto-accept hvis ja
2. Valider CanSend (cache → DB fallback)
3. SendMessageAsync()

**Cold path (ny samtale):**
1. Sjekk blokkering
2. Opprett alltid som PendingRequest — mottaker velger om de vil svare
3. Transaksjon: Opprett conversation + participants + message
4. Etter tx: SignalR + SyncEvents + MessageNotification

### Samtale-regler

- **PendingRequest:** Alle nye direktesamtaler starter her. Maks 5 meldinger før accept.
- **DirectChat:** Etter at mottaker aksepterer. Ubegrensede meldinger.
- **Auto-accept:** Hvis pending mottaker sender tilbake → aksepterer automatisk.

## Kritiske patterns

### Result Pattern + AppErrorCode

```csharp
// Service returnerer alltid Result med AppErrorCode:
if (user == null)
    return Result.Failure("User not found", AppErrorCode.NotFound);

if (!isPasswordValid)
    return Result.Failure("Wrong email or password", AppErrorCode.InvalidCredentials);

// Controller kaller HandleFailure — mapper AppErrorCode → HTTP-statuskode + AppProblemDetails:
if (result.IsFailure)
    return HandleFailure(result);
```

### AppErrorCode — domenespesifikke feilkoder

Alle feil bruker `AppErrorCode` (i `Common/Enum/AppErrorCode.cs`).
`HandleFailure` i `BaseController` mapper koden til HTTP-statuskode og returnerer `AppProblemDetails`.
Frontend speilet disse i `shared/types/error/AppErrorCode.ts`.

```
AppProblemDetails JSON:
{ "status": 401, "title": "Authentication Error", "detail": "...", "code": 2002 }
```

Koderanges:
- `0` — Unknown
- `1xxx` — Generelle (Validation, NotFound, Conflict, Unauthorized, Forbidden, InternalError, TooManyRequests, Gone, BadRequest, EmailSendFailed)
- `2xxx` — Autentisering (InvalidCredentials, AccountLocked, EmailNotConfirmed, PhoneNotConfirmed, TokenExpired, InvalidToken)
- `3xxx` — Registrering (EmailAlreadyExists, InvalidRegistrationData)
- `4xxx` — Verifisering (InvalidCode, ExpiredCode, AlreadyVerified)
- `5xxx` — Passord-reset (EmailNotFound)
- `6xxx` — Invitasjoner (InviteUserNotFound, InviteAlreadyInGroup, InviteUserLeft, InviteBlocked)
- `7xxx` — Kryptografi (InvalidPublicKey)

### AppProblemDetails

`BaseController.HandleFailure` returnerer alltid `AppProblemDetails` (ikke standard `ProblemDetails`).
`AppProblemDetails` arver `ProblemDetails` og legger til `Code`-feltet (int).
`GlobalExceptionHandler` returnerer fortsatt standard `ProblemDetails` uten `code` — kun for uventede exceptions.

### Transaksjonsmønster

```csharp
await tx.CommitAsync();    // 1. Lagre
await hub.SendAsync(...);  // 2. Best-effort
await sync.CreateEvent();  // 3. Pålitelig
```

SignalR-feil skal ikke rulle tilbake database.

### Cache-strategi

**CanSend Cache** — `user:{userId}:cansend` → Redis Set med conversationIds
- Invalider ved: Accept, Block, Archive, Leave
- Mønster: Cache → DB fallback → populer cache

**UserSummary Cache** — `user:summary:{userId}` → UserSummaryDto
- Permanent TTL (`DateTimeOffset.MaxValue`)
- Invalider ved: profilbilde/navneendring, brukersletting

```csharp
var summary = await GetUserSummaryAsync(userId);           // Single
var summaries = await GetUserSummariesAsync(listOfIds);    // Bulk (unngår N+1)
```

## Testing

**Framework:** xUnit + Moq + FluentAssertions

```csharp
// Arrange
var mockService = new Mock<IService>();
mockService.Setup(s => s.MethodAsync(...)).ReturnsAsync(result);

// Act + Assert
var result = await sut.MethodAsync();
result.Should().Be(expected);
mockService.Verify(s => s.MethodAsync(...), Times.Once);
```

**In-memory DB:** `UseInMemoryDatabase(Guid.NewGuid().ToString())` for isolasjon.

Se @.claude/rules/testing.md for detaljerte test-scenarios.

## Krypteringsregler

```
Backend validerer kun struktur
Backend dekrypterer aldri
Frontend håndterer all kryptering
```

## Gotchas

- **N+1 queries:** Bruk UserSummaries cache når du mapper meldinger
- **Pending-grense:** 5 meldinger maks før accept kreves
- **GroupConversationLeftRecord:** Må slettes for å bli med i gruppe igjen
- **SignalR i tx:** Aldri. Commit først, deretter SignalR.
- **Auth DummyUser:** Initialiseres ved oppstart — alltid med gjeldende Argon2id-parametere
- **AppErrorCode vs HTTP-statuskode:** AppErrorCode er domenekontrakten. HTTP-statuskoden utledes av `BuildProblemResult` i `BaseController` — aldri sett statuskode manuelt.

## Refaktoreringskonvensjon

```csharp
// Sjekk interface for summary
public async Task<Result<ConversationResponse>> GetConversationAsync(...)
```

- `// Sjekk interface for summary` = metoden er ferdig refaktorert
- XML summary kun i interface, ikke i implementasjonen

## DTO Navnekonvensjon

- **`Request`** — Data fra frontend til backend
- **`Response`** — Data fra backend til frontend
- **`Dto`** — Intern bruk i backend, mapping mellom lag

## Regler for Claude

- **ALDRI opprett nye modeller eller legg til egenskaper uten eksplisitt bekreftelse fra Magee**
- Foreslå alltid løsninger med eksisterende modeller først
