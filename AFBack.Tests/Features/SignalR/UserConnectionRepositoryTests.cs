using AFBack.Features.SignalR.Models;
using AFBack.Features.SignalR.Repository;
using AFBack.Tests.Builders;
using AFBack.Tests.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Tests.Features.SignalR;

[Collection(nameof(IntegrationTestsCollection))]
public class UserConnectionRepositoryTests(BackendApplicationFactory factory) : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await factory.ResetDatabaseAsync();

    // ======================== GetActiveConnectionIdsAsync ========================

    [Fact]
    public async Task GetActiveConnectionIdsAsync_ShouldOnlyReturnConnectedConnections()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
            db.UserDevices.Add(device);
            await db.SaveChangesAsync();

            db.UserOnlineStatuses.AddRange(
                Connection(user.Id, "conn-active",       isConnected: true,  deviceId: device.Id),
                Connection(user.Id, "conn-disconnected", isConnected: false, deviceId: device.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetActiveConnectionIdsAsync(user.Id));

        // Assert
        result.Should().ContainSingle("conn-active");
        result.Should().NotContain("conn-disconnected");
    }

    // ======================== GetOtherActiveConnectionIdsAsync ========================

    [Fact]
    public async Task GetOtherActiveConnectionIdsAsync_ShouldExcludeSpecifiedDevice()
    {
        // Arrange
        var user    = new UserBuilder().AsVerified().Build();
        var deviceA = new UserDeviceBuilder().ForUser(user.Id).Build();
        var deviceB = new UserDeviceBuilder().ForUser(user.Id).Build();

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
            db.UserDevices.AddRange(deviceA, deviceB);
            await db.SaveChangesAsync();

            db.UserOnlineStatuses.AddRange(
                Connection(user.Id, "conn-a", isConnected: true, deviceId: deviceA.Id),
                Connection(user.Id, "conn-b", isConnected: true, deviceId: deviceB.Id));
            await db.SaveChangesAsync();
        });

        // Act
        var result = await RunQuery(r => r.GetOtherActiveConnectionIdsAsync(user.Id, deviceA.Id));

        // Assert
        result.Should().ContainSingle("conn-b");
        result.Should().NotContain("conn-a");
    }

    // ======================== DeleteStaleConnectionsAsync ========================

    [Fact]
    public async Task DeleteStaleConnectionsAsync_ShouldOnlyDeleteConnectedConnectionsBeforeCutoff()
    {
        // Arrange
        var user   = new UserBuilder().AsVerified().Build();
        var device = new UserDeviceBuilder().ForUser(user.Id).Build();
        var cutoff = DateTime.UtcNow;

        await factory.SeedAsync(async db =>
        {
            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
            db.UserDevices.Add(device);
            await db.SaveChangesAsync();

            db.UserOnlineStatuses.AddRange(
                Connection(user.Id, "stale",        isConnected: true,  deviceId: device.Id, heartbeat: cutoff.AddMinutes(-10)),
                Connection(user.Id, "fresh",        isConnected: true,  deviceId: device.Id, heartbeat: cutoff.AddMinutes(1)),
                Connection(user.Id, "disconnected", isConnected: false, deviceId: device.Id, heartbeat: cutoff.AddMinutes(-10)));
            await db.SaveChangesAsync();
        });

        // Act
        var deleted = await RunQuery(r => r.DeleteStaleConnectionsAsync(cutoff));

        // Assert
        deleted.Should().Be(1);

        var remaining = await factory.QueryAsync(async db =>
            await db.UserOnlineStatuses.CountAsync());
        remaining.Should().Be(2);
    }

    // ======================== Hjelpemetoder ========================

    private static UserConnection Connection(
        string userId,
        string connectionId,
        bool isConnected,
        int deviceId = 1,
        DateTime? heartbeat = null) =>
        new()
        {
            UserId        = userId,
            ConnectionId  = connectionId,
            IsConnected   = isConnected,
            UserDeviceId  = deviceId,
            LastHeartbeat = heartbeat ?? DateTime.UtcNow
        };

    private Task<T> RunQuery<T>(Func<UserConnectionRepository, Task<T>> query) =>
        factory.QueryAsync(async db => await query(new UserConnectionRepository(db)));
}
