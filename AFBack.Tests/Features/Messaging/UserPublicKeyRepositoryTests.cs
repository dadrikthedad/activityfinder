using AFBack.Features.Messaging.Models;
using AFBack.Features.Messaging.Repository;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Messaging;

[Collection(nameof(IntegrationTestsCollection))]
public class UserPublicKeyRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetActiveUserPublicKeyAsync ========================

    [Fact]
    public async Task GetActiveUserPublicKeyAsync_ShouldOnlyReturnActiveKey()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();

            db.UserPublicKeys.AddRange(
                Key(user.Id, isActive: true,  publicKey: "active-key"),
                Key(user.Id, isActive: false, publicKey: "inactive-key"));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetActiveUserPublicKeyAsync(user.Id));

        // Assert
        result.Should().NotBeNull();
        result!.PublicKey.Should().Be("active-key");
    }

    [Fact]
    public async Task GetActiveUserPublicKeyAsync_WhenNoActiveKey_ShouldReturnNull()
    {
        // Arrange
        var user = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();

            db.UserPublicKeys.Add(Key(user.Id, isActive: false, publicKey: "old-key"));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetActiveUserPublicKeyAsync(user.Id));

        // Assert
        result.Should().BeNull();
    }

    // ======================== GetActiveKeysForUsersAsync ========================

    [Fact]
    public async Task GetActiveKeysForUsersAsync_ShouldOnlyReturnActiveKeysForRequestedUsers()
    {
        // Arrange
        var userA = new UserBuilder().AsVerified().Build();
        var userB = new UserBuilder().AsVerified().Build();
        var userC = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB, userC);
            await db.SaveChangesAsync();

            db.UserPublicKeys.AddRange(
                Key(userA.Id, isActive: true,  publicKey: "key-a"),
                Key(userB.Id, isActive: true,  publicKey: "key-b"),
                Key(userC.Id, isActive: true,  publicKey: "key-c")); // ikke etterspurt
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r =>
            r.GetActiveKeysForUsersAsync([userA.Id, userB.Id]));

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(k => k.UserId == userA.Id);
        result.Should().Contain(k => k.UserId == userB.Id);
        result.Should().NotContain(k => k.UserId == userC.Id);
    }

    // ======================== Hjelpemetoder ========================

    private static UserPublicKey Key(string userId, bool isActive, string publicKey) =>
        new()
        {
            UserId    = userId,
            IsActive  = isActive,
            PublicKey = publicKey
        };

    private Task<T> RunQuery<T>(Func<UserPublicKeyRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new UserPublicKeyRepository(db)));
}
