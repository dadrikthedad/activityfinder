using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Models;
using AFBack.Features.SyncEvents.Repository;
using Microsoft.EntityFrameworkCore;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.SyncEvents;

[Collection(nameof(IntegrationTestsCollection))]
public class SyncEventRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetSyncEventsAsync ========================

    [Fact]
    public async Task GetSyncEventsAsync_ShouldOnlyReturnEventsAfterTimestamp()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var cutoff = DateTime.UtcNow;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();

            db.SyncEvents.AddRange(
                Event(user.Id, cutoff.AddMinutes(-5)),  // for gammel
                Event(user.Id, cutoff.AddMinutes(1)));  // etter cutoff
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunQuery(r => r.GetSyncEventsAsync(user.Id, cutoff));

        // Assert
        results.Should().ContainSingle();
        results[0].CreatedAt.Should().BeAfter(cutoff);
    }

    [Fact]
    public async Task GetSyncEventsAsync_ShouldReturnEventsOrderedByCreatedAtAscending()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var cutoff = DateTime.UtcNow.AddHours(-1);

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();

            db.SyncEvents.AddRange(
                Event(user.Id, cutoff.AddMinutes(10)),
                Event(user.Id, cutoff.AddMinutes(5)),
                Event(user.Id, cutoff.AddMinutes(20)));
            await db.SaveChangesAsync();
        });

        // Act
        var results = await RunQuery(r => r.GetSyncEventsAsync(user.Id, cutoff));

        // Assert
        results.Should().HaveCount(3);
        results.Should().BeInAscendingOrder(e => e.CreatedAt);
    }

    // ======================== CountEventsSinceTimestamp ========================

    [Fact]
    public async Task CountEventsSinceTimestamp_ShouldOnlyCountEventsAfterTimestamp()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var cutoff = DateTime.UtcNow;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();

            db.SyncEvents.AddRange(
                Event(user.Id, cutoff.AddMinutes(-10)), // for gammel
                Event(user.Id, cutoff.AddMinutes(1)),   // etter
                Event(user.Id, cutoff.AddMinutes(2)));  // etter
            await db.SaveChangesAsync();
        });

        // Act
        var count = await RunQuery(r => r.CountEventsSinceTimestamp(user.Id, cutoff));

        // Assert
        count.Should().Be(2);
    }

    // ======================== DeleteEventsOlderThanAsync ========================

    [Fact]
    public async Task DeleteEventsOlderThanAsync_ShouldOnlyDeleteEventsBeforeCutoff()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();
        var cutoff = DateTime.UtcNow;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();

            db.SyncEvents.AddRange(
                Event(user.Id, cutoff.AddMinutes(-10)), // skal slettes
                Event(user.Id, cutoff.AddMinutes(-5)),  // skal slettes
                Event(user.Id, cutoff.AddMinutes(1)));  // skal beholdes
            await db.SaveChangesAsync();
        });

        // Act
        var deleted = await RunQuery(r => r.DeleteEventsOlderThanAsync(cutoff));

        // Assert
        deleted.Should().Be(2);

        var remaining = await factory.QueryAsync(async db =>
            await db.SyncEvents.CountAsync());
        remaining.Should().Be(1);
    }

    // ======================== Hjelpemetoder ========================

    private static SyncEvent Event(string userId, DateTime createdAt) =>
        new() { UserId = userId, CreatedAt = createdAt, EventType = SyncEventType.NewMessage, EventData = "{}" };

    private Task<T> RunQuery<T>(Func<SyncEventRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new SyncEventRepository(db)));
}
