# Testing-regler

## Test-struktur

**Framework:** xUnit + Moq + FluentAssertions + InMemoryDatabase

**Organisering:** Tester speiler feature-struktur
```
AFBack.Tests/
├── Features/
│   ├── Auth/
│   ├── Conversation/
│   ├── Messaging/
│   └── [Feature]/
└── Infrastructure/
```

## Test-mønster

```csharp
public class ServiceTests
{
    private readonly Mock<IDependency> _mockDep;

    public ServiceTests()
    {
        _mockDep = new Mock<IDependency>();
    }

    [Fact]
    public async Task Method_WhenCondition_ShouldExpectedBehavior()
    {
        // Arrange
        _mockDep.Setup(d => d.MethodAsync(It.IsAny<T>())).ReturnsAsync(result);
        var sut = new Service(_mockDep.Object);

        // Act
        var result = await sut.MethodAsync(input);

        // Assert
        result.Should().Be(expected);
        _mockDep.Verify(d => d.MethodAsync(It.IsAny<T>()), Times.Once);
    }
}
```

## InMemory Database-oppsett

```csharp
private ApplicationDbContext CreateInMemoryContext()
{
    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()) // Unik per test
        .Options;

    return new ApplicationDbContext(options);
}
```

**Kritisk:** Bruk `Guid.NewGuid().ToString()` for isolasjon mellom tester.

## Test-prioriteringer

### Auth (pågående)

**Login:**
- [ ] Riktig epost + passord → returnerer AccessToken + RefreshToken
- [ ] Feil passord → 401, teller opp AccessFailedCount
- [ ] 5 feilede forsøk → konto låst i 5 min (lockout)
- [ ] Ukjent epost → 401, lik responstid som kjent epost (DummyUser)
- [ ] Uverifisert epost → sender verifiseringsepost, returnerer feil
- [ ] Uverifisert telefon → sender verifiserings-SMS, returnerer feil
- [ ] Ny enhet → oppretter UserDevice
- [ ] Kjent enhet → gjenbruker eksisterende UserDevice

**Token Refresh:**
- [ ] Gyldig refresh token → nytt token-par (rotation)
- [ ] Allerede revokert token → revoker ALLE tokens for brukeren (reuse detection)
- [ ] Utløpt refresh token → 401
- [ ] Feil DeviceFingerprint → 401 (device binding)

**Logout:**
- [ ] Logout → refresh token revokert i DB, access token blacklistet i Redis
- [ ] Logout-all → alle refresh tokens revokert, nåværende access token blacklistet

**Sikkerhet:**
- [ ] Blacklistet access token → 401 på påfølgende requests
- [ ] DummyUser-timing: login med ukjent epost tar tilnærmet samme tid som kjent epost

### SendMessageToUser

- [ ] PendingRequest opprettes for ny samtale
- [ ] Auto-accept når pending mottaker sender tilbake
- [ ] Blokkering forhindrer sending
- [ ] Meldingsgrense (5) for pending

### Samtale-håndtering

- [ ] Accept pending request
- [ ] Reject pending request
- [ ] Archive samtale
- [ ] Block bruker
- [ ] Leave gruppe
- [ ] Cache-invalidering triggers

### Edge cases

- [ ] Samtidig pending accept (race condition)
- [ ] GroupConversationLeftRecord håndtering
- [ ] N+1 query-forebygging (mock UserSummaries cache)

## Mock-oppsett patterns

### Service-avhengigheter
```csharp
var mockRepo = new Mock<IRepository>();
var mockCache = new Mock<ICacheService>();
var mockHub = new Mock<IHubContext<MessageHub>>();
```

### Result Pattern-mocking
```csharp
// Success
mockService.Setup(s => s.GetAsync(id))
    .ReturnsAsync(Result<T>.Success(value));

// Failure
mockService.Setup(s => s.GetAsync(id))
    .ReturnsAsync(Result<T>.Failure("Not found", ErrorTypeEnum.NotFound));
```

### Cache-mocking
```csharp
// Cache hit
mockCache.Setup(c => c.GetSetAsync(key))
    .ReturnsAsync(new HashSet<Guid> { conversationId });

// Cache miss
mockCache.Setup(c => c.GetSetAsync(key))
    .ReturnsAsync((HashSet<Guid>?)null);
```

### Auth-spesifikt

```csharp
// DummyUser-mocking — må returnere en bruker med gyldig Argon2id-hash
mockUserRepo.Setup(r => r.GetDummyUserAsync())
    .ReturnsAsync(dummyUser);

// Redis blacklist-mocking
mockRedis.Setup(r => r.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(),
    It.IsAny<TimeSpan?>(), It.IsAny<When>(), It.IsAny<CommandFlags>()))
    .ReturnsAsync(true);

// Token reuse detection — revokert token trigger full invalidering
mockRefreshTokenRepo.Setup(r => r.GetByTokenAsync(revokedToken))
    .ReturnsAsync(new RefreshToken { IsRevoked = true });
```

## Kommandoer

```bash
# Alle tester
dotnet test

# Spesifikk feature
dotnet test --filter "FullyQualifiedName~Auth"
dotnet test --filter "FullyQualifiedName~Conversation"

# Spesifikk kategori
dotnet test --filter "Category=Integration"

# Watch mode
dotnet watch test
```

## FluentAssertions-bruk

```csharp
// Verdier
result.Value.Should().NotBeNull();
result.Error.Should().BeNullOrEmpty();

// Samlinger
conversations.Should().HaveCount(5);
conversations.Should().Contain(c => c.Id == expectedId);

// Result Pattern
result.IsSuccess.Should().BeTrue();
result.IsFailure.Should().BeFalse();
result.ErrorType.Should().Be(ErrorTypeEnum.NotFound);

// Auth-spesifikt
response.AccessToken.Should().NotBeNullOrEmpty();
refreshToken.IsRevoked.Should().BeTrue();
refreshToken.RevokedReason.Should().Be("Rotated during refresh");
```

## TODO

- [ ] Integrasjonstester for full Login-flyt
- [ ] Integrasjonstester for Token Refresh + reuse detection
- [ ] Integrasjonstester for full SendMessageToUser-flyt
- [ ] Cache-invalidering integrasjonstester
