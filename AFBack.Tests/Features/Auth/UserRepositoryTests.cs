using AFBack.Features.Auth.Repositories;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;


namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class UserRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetUnverifiedUsersAsync ========================

    [Fact]
    public async Task GetUnverifiedUsersAsync_WhenNeitherVerified_AndOlderThanNothingCutoff_ShouldBeIncluded()
    {
        // Arrange
        var user = new UserBuilder()
            .AsUnverified()
            .WithCreatedAt(DateTime.UtcNow.AddDays(-10))
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        var nothingCutoff   = DateTime.UtcNow.AddDays(-7);
        var partiallyCutoff = DateTime.UtcNow.AddDays(-3);

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUnverifiedUsersAsync(nothingCutoff, partiallyCutoff));

        // Assert
        result.Should().ContainSingle(u => u.Id == user.Id);
    }

    [Fact]
    public async Task GetUnverifiedUsersAsync_WhenNeitherVerified_AndNewerThanNothingCutoff_ShouldNotBeIncluded()
    {
        // Arrange — opprettet nå, cutoff er 7 dager siden
        var user = new UserBuilder()
            .AsUnverified()
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        var nothingCutoff   = DateTime.UtcNow.AddDays(-7);
        var partiallyCutoff = DateTime.UtcNow.AddDays(-3);

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUnverifiedUsersAsync(nothingCutoff, partiallyCutoff));

        // Assert
        result.Should().NotContain(u => u.Id == user.Id);
    }

    [Fact]
    public async Task GetUnverifiedUsersAsync_WhenEmailOnlyVerified_AndOlderThanPartiallyCutoff_ShouldBeIncluded()
    {
        // Arrange — epost verifisert, telefon ikke, opprettet 10 dager siden
        var user = new UserBuilder()
            .AsPhoneUnverified()
            .WithCreatedAt(DateTime.UtcNow.AddDays(-10))
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        var nothingCutoff   = DateTime.UtcNow.AddDays(-14);
        var partiallyCutoff = DateTime.UtcNow.AddDays(-7);

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUnverifiedUsersAsync(nothingCutoff, partiallyCutoff));

        // Assert
        result.Should().ContainSingle(u => u.Id == user.Id);
    }

    [Fact]
    public async Task GetUnverifiedUsersAsync_WhenEmailOnlyVerified_AndNewerThanPartiallyCutoff_ShouldNotBeIncluded()
    {
        // Arrange — epost verifisert, telefon ikke, men opprettet nylig
        var user = new UserBuilder()
            .AsPhoneUnverified()
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        var nothingCutoff   = DateTime.UtcNow.AddDays(-14);
        var partiallyCutoff = DateTime.UtcNow.AddDays(-7);

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUnverifiedUsersAsync(nothingCutoff, partiallyCutoff));

        // Assert
        result.Should().NotContain(u => u.Id == user.Id);
    }

    [Fact]
    public async Task GetUnverifiedUsersAsync_WhenFullyVerified_ShouldNeverBeIncluded()
    {
        // Arrange — fullt verifisert, opprettet lenge siden (skal aldri ryddes)
        var user = new UserBuilder()
            .AsVerified()
            .WithCreatedAt(DateTime.UtcNow.AddYears(-1))
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        var nothingCutoff   = DateTime.UtcNow.AddDays(-1);
        var partiallyCutoff = DateTime.UtcNow.AddDays(-1);

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUnverifiedUsersAsync(nothingCutoff, partiallyCutoff));

        // Assert
        result.Should().NotContain(u => u.Id == user.Id);
    }

    // ======================== GetUserSummaryAsync ========================

    [Fact]
    public async Task GetUserSummaryAsync_WhenUserExists_ShouldReturnCorrectSummary()
    {
        // Arrange
        var user = new UserBuilder()
            .WithFirstName("Ola")
            .WithLastName("Nordmann")
            .AsVerified()
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUserSummaryAsync(user.Id));

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(user.Id);
        result.FullName.Should().Be("Ola Nordmann");
        result.ProfileImageUrl.Should().BeNull();
    }

    [Fact]
    public async Task GetUserSummaryAsync_WhenUserDoesNotExist_ShouldReturnNull()
    {
        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUserSummaryAsync(Guid.NewGuid().ToString()));

        // Assert
        result.Should().BeNull();
    }

    // ======================== GetUserSummariesAsync ========================

    [Fact]
    public async Task GetUserSummariesAsync_WhenSomeIdsDoNotExist_ShouldReturnOnlyExistingUsers()
    {
        // Arrange
        var userA = new UserBuilder().AsVerified().Build();
        var userB = new UserBuilder().AsVerified().Build();
        var unknownId = Guid.NewGuid().ToString();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.AddRange(userA, userB);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUserSummariesAsync([userA.Id, userB.Id, unknownId]));

        // Assert
        result.Should().HaveCount(2);
        result.Should().ContainKey(userA.Id);
        result.Should().ContainKey(userB.Id);
        result.Should().NotContainKey(unknownId);
    }

    // ======================== GetUserWithProfileAndSettingsAsync ========================

    [Fact]
    public async Task GetUserWithProfileAndSettingsAsync_WhenUserHasProfileAndSettings_ShouldIncludeBoth()
    {
        // Arrange
        var userId  = Guid.NewGuid().ToString();
        var profile  = new UserProfileBuilder().ForUser(userId).Build();
        var settings = new UserSettingsBuilder().ForUser(userId).Build();
        var user     = new UserBuilder().WithId(userId).AsVerified()
            .WithProfile(profile).WithSettings(settings).Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUserWithProfileAndSettingsAsync(userId));

        // Assert
        result.Should().NotBeNull();
        result!.UserProfile.Should().NotBeNull();
        result.UserSettings.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserWithProfileAndSettingsAsync_WhenUserDoesNotExist_ShouldReturnNull()
    {
        // Act
        var result = await factory.QueryAsync(async db =>
            await new UserRepository(db).GetUserWithProfileAndSettingsAsync(Guid.NewGuid().ToString()));

        // Assert
        result.Should().BeNull();
    }
}
