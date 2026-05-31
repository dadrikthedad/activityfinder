using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;

namespace AFBack.Tests.Features.Auth;

[Collection(nameof(IntegrationTestsCollection))]
public class RefreshTokenRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetActiveTokensByUserIdAsync ========================

    [Fact]
    public async Task GetActiveTokensByUserIdAsync_WhenTokenIsActiveAndValid_ShouldBeReturned()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var token = new RefreshTokenBuilder().ForUser(user.Id).ForDevice(deviceId).Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(token);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new RefreshTokenRepository(db).GetActiveTokensByUserIdAsync(user.Id));

        // Assert
        result.Should().ContainSingle(t => t.Token == token.Token);
    }

    [Fact]
    public async Task GetActiveTokensByUserIdAsync_WhenTokenIsRevoked_ShouldNotBeReturned()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var token = new RefreshTokenBuilder().ForUser(user.Id).ForDevice(deviceId).AsRevoked().Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(token);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new RefreshTokenRepository(db).GetActiveTokensByUserIdAsync(user.Id));

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetActiveTokensByUserIdAsync_WhenTokenIsExpired_ShouldNotBeReturned()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var token = new RefreshTokenBuilder().ForUser(user.Id).ForDevice(deviceId).AsExpired().Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(token);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new RefreshTokenRepository(db).GetActiveTokensByUserIdAsync(user.Id));

        // Assert
        result.Should().BeEmpty();
    }

    // ======================== GetActiveTokensByDeviceIdAsync ========================

    [Fact]
    public async Task GetActiveTokensByDeviceIdAsync_WhenTokenIsRevoked_ShouldNotBeReturned()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var token = new RefreshTokenBuilder().ForUser(user.Id).ForDevice(deviceId).AsRevoked().Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(token);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new RefreshTokenRepository(db).GetActiveTokensByDeviceIdAsync(deviceId));

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetActiveTokensByDeviceIdAsync_WhenTokenIsExpired_ShouldNotBeReturned()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var token = new RefreshTokenBuilder().ForUser(user.Id).ForDevice(deviceId).AsExpired().Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(token);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new RefreshTokenRepository(db).GetActiveTokensByDeviceIdAsync(deviceId));

        // Assert
        result.Should().BeEmpty();
    }

    // ======================== GetByTokenWithDeviceAsync ========================

    [Fact]
    public async Task GetByTokenWithDeviceAsync_WhenTokenExists_ShouldIncludeUserAndDevice()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var token = new RefreshTokenBuilder().ForUser(user.Id).ForDevice(deviceId).Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(token);
            await db.SaveChangesAsync();
        });

        // Act
        var result = await factory.QueryAsync(async db =>
            await new RefreshTokenRepository(db).GetByTokenWithDeviceAsync(token.Token));

        // Assert
        result.Should().NotBeNull();
        result!.AppUser.Should().NotBeNull();
        result.UserDevice.Should().NotBeNull();
    }

    // ======================== DeleteExpiredAndOldRevokedAsync ========================

    [Fact]
    public async Task DeleteExpiredAndOldRevokedAsync_WhenTokenIsExpired_ShouldBeDeleted()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var expiredToken = new RefreshTokenBuilder()
            .ForUser(user.Id).ForDevice(deviceId)
            .AsExpired()
            .Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(expiredToken);
            await db.SaveChangesAsync();
        });

        var expiredBefore = DateTime.UtcNow;
        var revokedBefore = DateTime.UtcNow.AddDays(-30);

        // Act
        await factory.QueryAsync(async db =>
        {
            await new RefreshTokenRepository(db)
                .DeleteExpiredAndOldRevokedAsync(expiredBefore, revokedBefore, CancellationToken.None);
            return 0;
        });

        // Assert
        var remaining = await factory.QueryAsync(async db =>
            await db.RefreshTokens.FindAsync(expiredToken.Id));
        remaining.Should().BeNull();
    }

    [Fact]
    public async Task DeleteExpiredAndOldRevokedAsync_WhenTokenIsRevokedAndOld_ShouldBeDeleted()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        await factory.SeedUserWithManagerAsync(user, TestConstants.Users.DefaultPassword);
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        int deviceId = 0;
        await factory.SeedAsync(async db =>
        {
            db.Set<UserDevice>().Add(device);
            await db.SaveChangesAsync();
            deviceId = device.Id;
        });

        var oldRevokedToken = new RefreshTokenBuilder()
            .ForUser(user.Id).ForDevice(deviceId)
            .AsRevoked()
            .RevokedAt(DateTime.UtcNow.AddDays(-60))
            .Build();
        await factory.SeedAsync(async db =>
        {
            db.RefreshTokens.Add(oldRevokedToken);
            await db.SaveChangesAsync();
        });

        var expiredBefore = DateTime.UtcNow.AddDays(-400); // ikke utløpt — tester kun revoked-grenen
        var revokedBefore = DateTime.UtcNow.AddDays(-30);  // revokert for 60 dager siden → skal slettes

        // Act
        await factory.QueryAsync(async db =>
        {
            await new RefreshTokenRepository(db)
                .DeleteExpiredAndOldRevokedAsync(expiredBefore, revokedBefore, CancellationToken.None);
            return 0;
        });

        // Assert
        var remaining = await factory.QueryAsync(async db =>
            await db.RefreshTokens.FindAsync(oldRevokedToken.Id));
        remaining.Should().BeNull();
    }
}
