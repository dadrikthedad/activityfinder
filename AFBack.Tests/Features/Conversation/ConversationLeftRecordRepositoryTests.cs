using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Conv = AFBack.Features.Conversation.Models.Conversation;

namespace AFBack.Tests.Features.Conversation;

[Collection(nameof(IntegrationTestsCollection))]
public class ConversationLeftRecordRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetByUserIdPaginatedAsync ========================

    [Fact]
    public async Task GetByUserIdPaginatedAsync_ShouldReturnNewestFirst()
    {
        // Arrange
        var user  = new UserBuilder().AsVerified().Build();
        var conv1 = new Conv();
        var conv2 = new Conv();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.AddRange(conv1, conv2);
            await db.SaveChangesAsync();

            db.ConversationLeftRecords.AddRange(
                LeftRecord(user.Id, conv1.Id, leftAt: DateTime.UtcNow.AddDays(-2)),
                LeftRecord(user.Id, conv2.Id, leftAt: DateTime.UtcNow.AddDays(-1)));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetByUserIdPaginatedAsync(user.Id, page: 1, pageSize: 10));

        // Assert
        result.Should().HaveCount(2);
        result[0].ConversationId.Should().Be(conv2.Id);
        result[1].ConversationId.Should().Be(conv1.Id);
    }

    [Fact]
    public async Task GetByUserIdPaginatedAsync_ShouldRespectPageSize()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var convs = Enumerable.Range(0, 4).Select(_ => new Conv()).ToList();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            db.Conversations.AddRange(convs);
            await db.SaveChangesAsync();

            foreach (var (conv, i) in convs.Select((c, i) => (c, i)))
                db.ConversationLeftRecords.Add(
                    LeftRecord(user.Id, conv.Id, leftAt: DateTime.UtcNow.AddDays(-i)));
            await db.SaveChangesAsync();
        });

        // Act — side 1 med pageSize 2
        var page1 = await RunQuery(r => r.GetByUserIdPaginatedAsync(user.Id, page: 1, pageSize: 2));
        var page2 = await RunQuery(r => r.GetByUserIdPaginatedAsync(user.Id, page: 2, pageSize: 2));

        // Assert
        page1.Should().HaveCount(2);
        page2.Should().HaveCount(2);
        page2.Should().NotContain(r => page1.Any(p => p.ConversationId == r.ConversationId));
    }

    // ======================== Hjelpemetoder ========================

    private static ConversationLeftRecord LeftRecord(string userId, int conversationId, DateTime leftAt) =>
        new() { UserId = userId, ConversationId = conversationId, LeftAt = leftAt };

    private Task<T> RunQuery<T>(Func<ConversationLeftRecordRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new ConversationLeftRecordRepository(db)));
}
