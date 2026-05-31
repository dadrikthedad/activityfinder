using AFBack.Features.Blocking.Models;
using AFBack.Features.Blocking.Repository;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Blocking;

[Collection(nameof(IntegrationTestsCollection))]
public class UserBlockRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetAsync ========================

    [Fact]
    public async Task GetAsync_WhenBlockExists_ShouldReturnBlock()
    {
        // Arrange
        var blocker = new UserBuilder().AsVerified().Build();
        var blocked = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(blocker, blocked);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = blocked.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetAsync(blocker.Id, blocked.Id));

        // Assert
        result.Should().NotBeNull();
        result!.BlockerId.Should().Be(blocker.Id);
        result.BlockedUserId.Should().Be(blocked.Id);
    }

    [Fact]
    public async Task GetAsync_WhenBlockerIdDoesNotMatch_ShouldReturnNull()
    {
        // Arrange
        var blocker = new UserBuilder().AsVerified().Build();
        var blocked = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(blocker, blocked);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = blocked.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetAsync(Guid.NewGuid().ToString(), blocked.Id));

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetAsync_WhenBlockedIdDoesNotMatch_ShouldReturnNull()
    {
        // Arrange
        var blocker = new UserBuilder().AsVerified().Build();
        var blocked = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(blocker, blocked);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = blocked.Id });
            await db.SaveChangesAsync();
        });

        // Act — riktig blocker, men feil blockedId
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetAsync(blocker.Id, Guid.NewGuid().ToString()));

        // Assert
        result.Should().BeNull();
    }

    // ======================== IsFirstUserBlockedBySecondary ========================

    [Fact]
    public async Task IsFirstUserBlockedBySecondary_WhenBlockExists_ShouldReturnTrue()
    {
        // Arrange — B har blokkert A
        var userA   = new UserBuilder().AsVerified().Build();
        var userB   = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB);
            db.UserBlocks.Add(new UserBlock { BlockerId = userB.Id, BlockedUserId = userA.Id });
            await db.SaveChangesAsync();
        });

        // Act — er A blokkert av B?
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).IsFirstUserBlockedBySecondary(userA.Id, userB.Id));

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsFirstUserBlockedBySecondary_WhenBlockIsInOppositeDirection_ShouldReturnFalse()
    {
        // Arrange — A har blokkert B, men vi spor om B har blokkert A
        var userA = new UserBuilder().AsVerified().Build();
        var userB = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB);
            db.UserBlocks.Add(new UserBlock { BlockerId = userA.Id, BlockedUserId = userB.Id });
            await db.SaveChangesAsync();
        });

        // Act — er A blokkert av B? (nei — det er A som har blokkert B)
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).IsFirstUserBlockedBySecondary(userA.Id, userB.Id));

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsFirstUserBlockedBySecondary_WhenNoBlockExists_ShouldReturnFalse()
    {
        // Arrange
        var userA = new UserBuilder().AsVerified().Build();
        var userB = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).IsFirstUserBlockedBySecondary(userA.Id, userB.Id));

        // Assert
        result.Should().BeFalse();
    }

    // ======================== GetBlockedUsersAsync ========================

    [Fact]
    public async Task GetBlockedUsersAsync_WhenBlockerHasBlockedMultipleUsers_ShouldReturnOnlyTheirBlocks()
    {
        // Arrange
        var blocker      = new UserBuilder().AsVerified().Build();
        var blockedOne   = new UserBuilder().AsVerified().Build();
        var blockedTwo   = new UserBuilder().AsVerified().Build();
        var otherBlocker = new UserBuilder().AsVerified().Build();
        var otherBlocked = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(blocker, blockedOne, blockedTwo, otherBlocker, otherBlocked);
            db.UserBlocks.AddRange(
                new UserBlock { BlockerId = blocker.Id,      BlockedUserId = blockedOne.Id },
                new UserBlock { BlockerId = blocker.Id,      BlockedUserId = blockedTwo.Id },
                new UserBlock { BlockerId = otherBlocker.Id, BlockedUserId = otherBlocked.Id }
            );
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetBlockedUsersAsync(blocker.Id));

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(b => b.BlockerId == blocker.Id);
    }

    [Fact]
    public async Task GetBlockedUsersAsync_ShouldIncludeBlockedAppUser()
    {
        // Arrange
        var blocker = new UserBuilder().AsVerified().Build();
        var blocked = new UserBuilder().WithFirstName("Kari").AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(blocker, blocked);
            db.UserBlocks.Add(new UserBlock { BlockerId = blocker.Id, BlockedUserId = blocked.Id });
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetBlockedUsersAsync(blocker.Id));

        // Assert
        result.Should().ContainSingle();
        result[0].BlockedAppUser.Should().NotBeNull();
        result[0].BlockedAppUser.FirstName.Should().Be("Kari");
    }

    [Fact]
    public async Task GetBlockedUsersAsync_ShouldReturnBlocksOrderedByBlockedAtDescending()
    {
        // Arrange
        var blocker    = new UserBuilder().AsVerified().Build();
        var firstBlock = new UserBuilder().AsVerified().Build();
        var lastBlock  = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(blocker, firstBlock, lastBlock);
            db.UserBlocks.AddRange(
                new UserBlock { BlockerId = blocker.Id, BlockedUserId = firstBlock.Id, BlockedAt = DateTime.UtcNow.AddDays(-5) },
                new UserBlock { BlockerId = blocker.Id, BlockedUserId = lastBlock.Id,  BlockedAt = DateTime.UtcNow.AddDays(-1) }
            );
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetBlockedUsersAsync(blocker.Id));

        // Assert — nyeste blokk (lastBlock) skal komme forst
        result.Should().HaveCount(2);
        result[0].BlockedUserId.Should().Be(lastBlock.Id);
        result[1].BlockedUserId.Should().Be(firstBlock.Id);
    }

    [Fact]
    public async Task GetBlockedUsersAsync_WhenNoBlocksExist_ShouldReturnEmptyList()
    {
        // Arrange
        var blocker = new UserBuilder().AsVerified().Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(blocker);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserBlockRepository(db).GetBlockedUsersAsync(blocker.Id));

        // Assert
        result.Should().BeEmpty();
    }
}
