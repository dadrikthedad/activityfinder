# Arkitekturregler — AFBack

## Vertical Slice

```
Features/[Feature]/
  ├── [Feature]Controller.cs   # API endpoints
  ├── [Feature]Service.cs      # Forretningslogikk
  ├── [Feature]Repository.cs   # Datahåndtering
  └── DTOs/                    # Request/Response
```

## DTO Navnekonvensjon

- **`Request`** — Data fra frontend til backend
- **`Response`** — Data fra backend til frontend
- **`Dto`** — Intern bruk i backend, mapping mellom lag

## Result Pattern + AppErrorCode

```csharp
// Service returnerer alltid Result med AppErrorCode:
if (user == null)
    return Result.Failure("User not found", AppErrorCode.NotFound);

// Controller kaller HandleFailure — mapper AppErrorCode → HTTP-statuskode + AppProblemDetails:
if (result.IsFailure)
    return HandleFailure(result);
```

## AppErrorCode — koderanges

Alle feil bruker `AppErrorCode` (i `Common/Enum/AppErrorCode.cs`).
`HandleFailure` i `BaseController` mapper koden til HTTP-statuskode og returnerer `AppProblemDetails`.
Frontend speilet disse i `shared/types/error/AppErrorCode.ts`.

```
{ "status": 401, "title": "Authentication Error", "detail": "...", "code": 2002 }
```

- `0` — Unknown
- `1xxx` — Generelle (Validation, NotFound, Conflict, Unauthorized, Forbidden, InternalError, TooManyRequests, Gone, BadRequest, EmailSendFailed)
- `2xxx` — Autentisering (InvalidCredentials, AccountLocked, EmailNotConfirmed, PhoneNotConfirmed, TokenExpired, InvalidToken)
- `3xxx` — Registrering (EmailAlreadyExists, InvalidRegistrationData)
- `4xxx` — Verifisering (InvalidCode, ExpiredCode, AlreadyVerified)
- `5xxx` — Passord-reset (EmailNotFound)
- `6xxx` — Invitasjoner (InviteUserNotFound, InviteAlreadyInGroup, InviteUserLeft, InviteBlocked)
- `7xxx` — Kryptografi (InvalidPublicKey)

`GlobalExceptionHandler` returnerer standard `ProblemDetails` uten `code` — kun for uventede exceptions.
**Aldri sett HTTP-statuskode manuelt** — utledes alltid av `BuildProblemResult` i `BaseController`.

## Transaksjonsmønster

```csharp
await tx.CommitAsync();    // 1. Lagre
await hub.SendAsync(...);  // 2. Best-effort
await sync.CreateEvent();  // 3. Pålitelig
```

SignalR-feil skal ikke rulle tilbake database.

## Cache-strategi

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

## Refaktoreringskonvensjon

```csharp
// Sjekk interface for summary
public async Task<Result<ConversationResponse>> GetConversationAsync(...)
```

- `// Sjekk interface for summary` = metoden er ferdig refaktorert
- XML summary kun i interface, ikke i implementasjonen
