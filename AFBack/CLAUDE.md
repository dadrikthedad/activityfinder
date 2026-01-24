# AFBack Backend

.NET 10 API for ende-til-ende kryptert meldingsapp. PostgreSQL + Redis + SignalR.

## Hurtigstart

```bash
dotnet run                              # Dev
dotnet watch run                        # Hot reload
dotnet ef migrations add Name           # Migration
dotnet ef database update               # Kjør migration
```

## Arkitektur: Vertical Slice

```
Features/[Feature]/
  ├── [Feature]Controller.cs   # API endpoints
  ├── [Feature]Service.cs      # Forretningslogikk  
  ├── [Feature]Repository.cs   # Datahåndtering
  └── DTOs/                    # Request/Response
```

**Status:** Oppretter alle endepunktene nødvendig til Conversations og deretter lage en GroupConversation-controller og 
service

## Forretningslogikk

### SendMessageToUser-flyt

**Hot path (eksisterende samtale):**
1. Sjekk om sender er pending → auto-accept hvis ja
2. Valider CanSend (cache → DB fallback)
3. SendMessageAsync()

**Cold path (ny samtale):**
1. Sjekk blokkering
2. Sjekk vennskap → DirectChat (venner) eller PendingRequest (ikke venner)
3. Transaksjon: Opprett conversation + participants + message
4. Etter tx: SignalR + SyncEvents + Notifications

### Samtale-regler

- **DirectChat:** Krever vennskap, begge Accepted, ubegrensede meldinger
- **PendingRequest:** Maks 5 meldinger før accept kreves
- **Auto-accept:** Hvis pending mottaker sender → aksepterer automatisk

### Hvorfor auto-accept?

Hvis du svarer på en request signaliserer det implisitt aksept. Bedre UX enn eksplisitt accept først.

**Edge case:** Begge sender samtidig mens pending → begge auto-accepts (harmløs)

## Kritiske patterns

### Result Pattern

```csharp
// Service
if (conversation == null)
    return Result.Failure("Not found", ErrorTypeEnum.NotFound); // → 404

// Controller
if (result.IsFailure)
    return HandleFailure(result); // Mapper ErrorType → HTTP status
```

Bruk Result for forretningsfeil, exceptions for tekniske feil. Result<T> er definert i Common/Results.

### Transaksjonsmønster

```csharp
await tx.CommitAsync();              // 1. Lagre
await hub.SendAsync(...);            // 2. Best-effort
await sync.CreateEvent(...);         // 3. Pålitelig
```

**Hvorfor:** SignalR-feil skal ikke rulle tilbake database. Data-konsistens > sanntid.

### Cache-strategi

#### CanSend Cache
`user:{userId}:cansend` → Redis Set med conversationIds

**Invalider ved:** Accept, Block, Archive, Leave

**Mønster:** Sjekk cache → fallback DB → populer cache

#### UserSummary Cache
`user:summary:{userId}` → UserSummaryDto (userId, profileImageUrl, fullName)

**Livstid:** Permanent (`AbsoluteExpiration = DateTimeOffset.MaxValue`)

**Invalider ved:** Profilbildeendring, navneendring, brukersletting

**Refresh:** Ved profiloppdateringer for å sikre konsistens

**Bulk-henting:**
- Parallell cache-lookup for alle userIds
- Hent kun manglende fra DB
- Populer cache for nye entries

**Mønster:**
```csharp
// Single user
var summary = await GetUserSummaryAsync(userId);

// Bulk (unngår N+1)
var summaries = await GetUserSummariesAsync(listOfUserIds);
```

## Krypteringsregler

```
Backend validerer kun struktur
Backend dekrypterer aldri
Frontend håndterer all kryptering
```

**KeyInfo:** JSON med encrypted symmetric keys per bruker.

## Testing

**Framework:** xUnit + Moq + FluentAssertions

**Mønster:**
```csharp
// Arrange
var mockService = new Mock<IService>();
mockService.Setup(s => s.MethodAsync(...)).ReturnsAsync(result);

// Act
var result = await sut.MethodAsync();

// Assert
result.Should().Be(expected);
mockService.Verify(s => s.MethodAsync(...), Times.Once);
```

**In-memory DB:** Bruk `UseInMemoryDatabase(Guid.NewGuid().ToString())` for isolasjon

Se @.claude/rules/testing.md for detaljerte test-scenarios (når opprettet)

## Gotchas

- **N+1 queries:** Bruk UserSummaries cache når du mapper meldinger
- **Pending-grense:** 5 meldinger maks før accept kreves
- **GroupConversationLeftRecord:** Må slettes for å bli med i gruppe igjen
- **SignalR i tx:** Aldri. Commit først, deretter SignalR.

## Neste

- Refaktorer User + Friendship til Vertical Slice
- Oppdater tester
- Legg til .claude/rules/testing.md med test-scenarios