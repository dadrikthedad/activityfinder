using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class LoginHistoryRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    private async Task<(string userId, int deviceId)> SeedUserWithDeviceAsync()
    {
        var user = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);

        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
        });

        return (user.Id, device.Id);
    }

    // ======================== GetActiveLoginAsync ========================

    [Fact]
    public async Task GetActiveLoginAsync_WhenMultipleActiveLogins_ShouldReturnMostRecent()
    {
        // Arrange
        var (userId, deviceId) = await SeedUserWithDeviceAsync();

        var older = new LoginHistoryBuilder()
            .ForUser(userId).ForDevice(deviceId)
            .LoginAt(DateTime.UtcNow.AddHours(-2))
            .Build();

        var newer = new LoginHistoryBuilder()
            .ForUser(userId).ForDevice(deviceId)
            .LoginAt(DateTime.UtcNow.AddHours(-1))
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.Set<LoginHistory>().AddRange(older, newer);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new LoginHistoryRepository(db).GetActiveLoginAsync(userId, deviceId));

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(newer.Id);
    }

    [Fact]
    public async Task GetActiveLoginAsync_WhenLoginIsLoggedOut_ShouldNotBeReturned()
    {
        // Arrange
        var (userId, deviceId) = await SeedUserWithDeviceAsync();

        var loggedOut = new LoginHistoryBuilder()
            .ForUser(userId).ForDevice(deviceId)
            .AsLoggedOut()
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.Set<LoginHistory>().Add(loggedOut);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new LoginHistoryRepository(db).GetActiveLoginAsync(userId, deviceId));

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetActiveLoginAsync_WhenDeviceIdDoesNotMatch_ShouldNotBeReturned()
    {
        // Arrange
        var (userId, deviceId) = await SeedUserWithDeviceAsync();

        var otherDevice = new UserDeviceBuilder().ForUser(userId).Build();
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(otherDevice);
            await db.SaveChangesAsync();
        });

        var loginOnOtherDevice = new LoginHistoryBuilder()
            .ForUser(userId).ForDevice(otherDevice.Id)
            .Build();

        await factory.SeedAsync(async db =>
        {
            db.Set<LoginHistory>().Add(loginOnOtherDevice);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new LoginHistoryRepository(db).GetActiveLoginAsync(userId, deviceId));

        // Assert
        result.Should().BeNull();
    }

    // ======================== GetActiveLoginsByUserIdAsync ========================

    [Fact]
    public async Task GetActiveLoginsByUserIdAsync_WhenMixedLogins_ShouldReturnOnlyActive()
    {
        // Arrange
        var (userId, deviceId) = await SeedUserWithDeviceAsync();

        var active    = new LoginHistoryBuilder().ForUser(userId).ForDevice(deviceId).Build();
        var loggedOut = new LoginHistoryBuilder().ForUser(userId).ForDevice(deviceId).AsLoggedOut().Build();

        await factory.SeedAsync(async db =>
        {
            db.Set<LoginHistory>().AddRange(active, loggedOut);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new LoginHistoryRepository(db).GetActiveLoginsByUserIdAsync(userId));

        // Assert
        result.Should().ContainSingle(lh => lh.Id == active.Id);
        result.Should().NotContain(lh => lh.Id == loggedOut.Id);
    }

    [Fact]
    public async Task GetActiveLoginsByUserIdAsync_WhenAllLoginsAreLoggedOut_ShouldReturnEmpty()
    {
        // Arrange
        var (userId, deviceId) = await SeedUserWithDeviceAsync();

        var loggedOut = new LoginHistoryBuilder().ForUser(userId).ForDevice(deviceId).AsLoggedOut().Build();

        await factory.SeedAsync(async db =>
        {
            db.Set<LoginHistory>().Add(loggedOut);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new LoginHistoryRepository(db).GetActiveLoginsByUserIdAsync(userId));

        // Assert
        result.Should().BeEmpty();
    }
}
