// using AFBack.Services;
// using AFBack.Interface.Services;
// using AFBack.Data;
// using AFBack.Configuration;
// using AFBack.Constants;
// using AFBack.Models;
// using Microsoft.EntityFrameworkCore;
// using Microsoft.Extensions.Options;
// using Microsoft.Extensions.Logging;
// using Microsoft.Extensions.DependencyInjection;
// using Moq;
// using Xunit;
// using FluentAssertions;
//
// namespace AFBack.Tests.Services;
//
// public class IpBanServiceTests : IDisposable
// {
//     private readonly ServiceProvider _serviceProvider;
//     private readonly ApplicationDbContext _context;
//     private readonly IpBanService _ipBanService; // ⬅️ Konkret klasse for å få tilgang til Dispose
//     private readonly Mock<ILogger<IpBanService>> _mockLogger;
//
//     public IpBanServiceTests()
//     {
//         var services = new ServiceCollection();
//         
//         services.AddDbContext<ApplicationDbContext>(options =>
//             options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
//         
//         _mockLogger = new Mock<ILogger<IpBanService>>();
//         services.AddSingleton(_mockLogger.Object);
//         
//         var options = Options.Create(new IpBanOptions
//         {
//             MaxSuspiciousAttempts = 5,
//             SuspiciousWindow = TimeSpan.FromMinutes(15),
//             TemporaryBanDuration = TimeSpan.FromHours(24),
//             WhitelistedIps = new List<string>(),
//             NegativeCacheDuration = TimeSpan.FromMinutes(5)
//         });
//         services.AddSingleton(options);
//         
//         _serviceProvider = services.BuildServiceProvider();
//         _context = _serviceProvider.GetRequiredService<ApplicationDbContext>();
//         
//         var scopeFactory = _serviceProvider.GetRequiredService<IServiceScopeFactory>();
//         _ipBanService = new IpBanService(scopeFactory, _mockLogger.Object, options);
//         
//         // ⬅️ Vent litt på at LoadActiveBansAsync kjører
//         Task.Delay(100).Wait();
//     }
//
//     [Fact]
//     public async Task ReportSuspiciousActivityAsync_With5Reports_ShouldBanIP()
//     {
//         var testIp = "192.168.1.100";
//
//         for (int i = 0; i < 5; i++)
//         {
//             await _ipBanService.ReportSuspiciousActivityAsync(
//                 testIp, "TEST_ACTIVITY", $"Test reason {i}", "TestAgent", "/test", null);
//         }
//         
//         // ⬅️ Vent på at ban blir prosessert
//         await Task.Delay(200);
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(testIp, null);
//         isBanned.Should().BeTrue();
//         
//         var banRecord = await _context.BanInfos
//             .FirstOrDefaultAsync(b => b.IpAddress == testIp && b.IsActive);
//         banRecord.Should().NotBeNull();
//         banRecord!.BanType.Should().Be(BanType.Temporary);
//     }
//
//     [Fact]
//     public async Task ReportSuspiciousActivityAsync_With4Reports_ShouldNotBanIP()
//     {
//         var testIp = "192.168.1.101";
//
//         for (int i = 0; i < 4; i++)
//         {
//             await _ipBanService.ReportSuspiciousActivityAsync(
//                 testIp, "TEST_ACTIVITY", $"Test reason {i}", "TestAgent", "/test", null);
//         }
//
//         await Task.Delay(200);
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(testIp, null);
//         isBanned.Should().BeFalse();
//     }
//
//     [Fact]
//     public async Task IsIpOrDeviceBannedAsync_WithExpiredBan_ShouldReturnFalse()
//     {
//         var testIp = "192.168.1.200";
//         
//         _context.BanInfos.Add(new BanInfo
//         {
//             IpAddress = testIp,
//             IsActive = true,
//             BanType = BanType.Temporary,
//             ExpiresAt = DateTime.UtcNow.AddHours(-1),
//             BannedAt = DateTime.UtcNow.AddHours(-25),
//             Reason = "Test expired ban"
//         });
//         await _context.SaveChangesAsync();
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(testIp, null);
//         isBanned.Should().BeFalse();
//     }
//
//     [Fact]
//     public async Task IsIpOrDeviceBannedAsync_WithActiveBan_ShouldReturnTrue()
//     {
//         var testIp = "192.168.1.201";
//         
//         _context.BanInfos.Add(new BanInfo
//         {
//             IpAddress = testIp,
//             IsActive = true,
//             BanType = BanType.Temporary,
//             ExpiresAt = DateTime.UtcNow.AddDays(1),
//             BannedAt = DateTime.UtcNow,
//             Reason = "Test active ban"
//         });
//         await _context.SaveChangesAsync();
//         
//         // ⬅️ Manuelt oppdater cache (siden LoadActiveBans kjørte før vi la til data)
//         await Task.Delay(100);
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(testIp, null);
//         isBanned.Should().BeTrue();
//     }
//
//     [Fact]
//     public async Task IsDeviceBannedAsync_WithActiveDeviceBan_ShouldReturnTrue()
//     {
//         var deviceId = "test-device-123";
//         
//         _context.BanInfos.Add(new BanInfo
//         {
//             DeviceId = deviceId,
//             IsActive = true,
//             BanType = BanType.Temporary,
//             ExpiresAt = DateTime.UtcNow.AddDays(1),
//             BannedAt = DateTime.UtcNow,
//             Reason = "Test device ban"
//         });
//         await _context.SaveChangesAsync();
//         
//         await Task.Delay(100);
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync("192.168.1.1", deviceId);
//         isBanned.Should().BeTrue();
//     }
//
//     [Fact]
//     public async Task IsDeviceBannedAsync_WithExpiredDeviceBan_ShouldReturnFalse()
//     {
//         var deviceId = "test-device-456";
//         
//         _context.BanInfos.Add(new BanInfo
//         {
//             DeviceId = deviceId,
//             IsActive = true,
//             BanType = BanType.Temporary,
//             ExpiresAt = DateTime.UtcNow.AddHours(-1),
//             BannedAt = DateTime.UtcNow.AddHours(-25),
//             Reason = "Test expired device ban"
//         });
//         await _context.SaveChangesAsync();
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync("192.168.1.1", deviceId);
//         isBanned.Should().BeFalse();
//     }
//
//     [Fact]
//     public async Task ReportSuspiciousActivityAsync_OnSharedNetwork_WithDevice_ShouldRequireMoreReports()
//     {
//         var sharedIp = "100.64.0.1";
//         var deviceId = "mobile-device-789";
//
//         // Report 5 times
//         for (int i = 0; i < 5; i++)
//         {
//             await _ipBanService.ReportSuspiciousActivityAsync(
//                 sharedIp, "TEST_ACTIVITY", $"Test {i}", "TestAgent", "/test", deviceId);
//         }
//         
//         await Task.Delay(200);
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(sharedIp, deviceId);
//         isBanned.Should().BeFalse();
//         
//         // Report 5 more times (total 10)
//         for (int i = 5; i < 10; i++)
//         {
//             await _ipBanService.ReportSuspiciousActivityAsync(
//                 sharedIp, "TEST_ACTIVITY", $"Test {i}", "TestAgent", "/test", deviceId);
//         }
//         
//         await Task.Delay(200);
//
//         isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(sharedIp, deviceId);
//         isBanned.Should().BeTrue();
//     }
//
//     [Fact]
//     public async Task ReportSuspiciousActivityAsync_OnSharedNetwork_WithoutDevice_ShouldNotBan()
//     {
//         var sharedIp = "100.64.0.2";
//
//         for (int i = 0; i < 10; i++)
//         {
//             await _ipBanService.ReportSuspiciousActivityAsync(
//                 sharedIp, "TEST_ACTIVITY", $"Test {i}", "TestAgent", "/test", null);
//         }
//         
//         await Task.Delay(200);
//
//         var isBanned = await _ipBanService.IsIpOrDeviceBannedAsync(sharedIp, null);
//         isBanned.Should().BeFalse();
//     }
//
//     [Fact]
//     public async Task GetRecentSuspiciousCountAsync_ShouldCountOnlyRecentActivities()
//     {
//         var testIp = "192.168.1.150";
//         
//         _context.SuspiciousActivities.Add(new SuspiciousActivity
//         {
//             IpAddress = testIp,
//             ActivityType = "OLD",
//             Timestamp = DateTime.UtcNow.AddMinutes(-20),
//             Reason = "Old activity"
//         });
//         
//         for (int i = 0; i < 3; i++)
//         {
//             _context.SuspiciousActivities.Add(new SuspiciousActivity
//             {
//                 IpAddress = testIp,
//                 ActivityType = "RECENT",
//                 Timestamp = DateTime.UtcNow.AddMinutes(-5),
//                 Reason = $"Recent activity {i}"
//             });
//         }
//         await _context.SaveChangesAsync();
//
//         var count = await _ipBanService.GetRecentSuspiciousCountAsync(_context, testIp, null);
//
//         count.Should().Be(3);
//     }
//
//     public void Dispose()
//     {
//         _ipBanService?.Dispose();
//         _context?.Dispose();
//         _serviceProvider?.Dispose();
//     }
// }