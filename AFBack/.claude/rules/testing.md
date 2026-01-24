# Testing-regler

## Test-struktur

**Framework:** xUnit + Moq + FluentAssertions + InMemoryDatabase

**Organisering:** Tester speiler feature-struktur
```
AFBack.Tests/
├── Features/
│   ├── Conversation/
│   ├── Messaging/
│   └── [Feature]/
└── Middleware/
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

**Kritisk:** Bruk `Guid.NewGuid().ToString()` for isolasjon mellom tester

## Test-prioriteringer

### Kritiske scenarios (må testes)

**SendMessageToUser:**
- [ ] DirectChat mellom venner
- [ ] PendingRequest mellom ikke-venner
- [ ] Auto-accept når pending mottaker sender
- [ ] Blokkering forhindrer sending
- [ ] Meldingsgrense (5) for pending

**Samtale-håndtering:**
- [ ] Accept pending request
- [ ] Archive samtale
- [ ] Block bruker
- [ ] Leave gruppe
- [ ] Cache-invalidering triggers

**Edge cases:**
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

## Kommandoer

```bash
# Alle tester
dotnet test

# Spesifikk feature
dotnet test --filter "FullyQualifiedName~Conversation"

# Spesifikk kategori (hvis du bruker [Trait])
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
```

## TODO

- [ ] Oppdater eksisterende tester etter Vertical Slice-refactoring
- [ ] Legg til tester for User feature (når refaktorert)
- [ ] Legg til tester for Friendship feature (når refaktorert)
- [ ] Integrasjonstester for full SendMessageToUser-flyt
- [ ] Cache-invalidering integrasjonstester