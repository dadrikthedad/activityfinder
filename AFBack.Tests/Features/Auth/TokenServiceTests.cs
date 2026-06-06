using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Transactions;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Moq;
using StackExchange.Redis;

namespace AFBack.Tests.Features.Auth;

public class TokenServiceTests
{
    private readonly Mock<IJwtService>               _jwtService;
    private readonly Mock<IRefreshTokenRepository>   _refreshTokenRepo;
    private readonly Mock<UserManager<AppUser>>      _userManager;
    private readonly TokenService                    _sut;

    private const string Ip        = "10.0.0.1";
    private const string UserAgent = "TestAgent/1.0";

    public TokenServiceTests()
    {
        _jwtService       = new Mock<IJwtService>();
        _refreshTokenRepo = new Mock<IRefreshTokenRepository>();

        var store = new Mock<IUserStore<AppUser>>();
        _userManager = new Mock<UserManager<AppUser>>(
            store.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        // Redis er ikke involvert i GenerateTokenPairAsync — vi bruker en minimal no-op mock
        var redis = new Mock<IConnectionMultiplexer>();

        _sut = new TokenService(
            _jwtService.Object,
            _refreshTokenRepo.Object,
            _userManager.Object,
            redis.Object,
            Mock.Of<ILogger<TokenService>>(),
            Mock.Of<ITransactionService>());

        // Standard oppsett
        _jwtService
            .Setup(j => j.GenerateJwtToken(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IEnumerable<string>>(), It.IsAny<int>()))
            .Returns("mocked-jwt-token");

        _refreshTokenRepo
            .Setup(r => r.GetActiveTokensByDeviceIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RefreshToken>());
    }

    private static AppUser MakeUser() => new()
    {
        Id       = Guid.NewGuid().ToString(),
        Email    = "bruker@test.no",
        FullName = "Test Bruker",
    };

    private static UserDevice MakeDevice(int id = 1) => new()
    {
        Id         = id,
        DeviceName = "Test Device",
    };

    // ======================== GenerateTokenPairAsync ========================

    [Fact]
    public async Task GenerateTokenPairAsync_WhenCalled_ShouldReturnTokenPairWithUserSummary()
    {
        // Arrange
        var user   = MakeUser();
        var device = MakeDevice();

        // Act
        var response = await _sut.GenerateTokenPairAsync(
            user, device, new List<string> { "User" }, Ip, UserAgent);

        // Assert
        response.AccessToken.Should().Be("mocked-jwt-token");
        response.RefreshToken.Should().NotBeNullOrEmpty();
        response.AccessTokenExpires.Should().BeAfter(DateTime.UtcNow);
        response.RefreshTokenExpires.Should().BeAfter(DateTime.UtcNow);
        response.User.Id.Should().Be(user.Id);
        response.User.FullName.Should().Be(user.FullName);
    }

    [Fact]
    public async Task GenerateTokenPairAsync_WhenCalled_ShouldPersistNewRefreshToken()
    {
        // Arrange
        var user   = MakeUser();
        var device = MakeDevice();

        RefreshToken? stored = null;
        _refreshTokenRepo
            .Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()))
            .Callback<RefreshToken, CancellationToken>((t, _) => stored = t);

        // Act
        await _sut.GenerateTokenPairAsync(user, device, new List<string>(), Ip, UserAgent);

        // Assert
        stored.Should().NotBeNull();
        stored!.UserId.Should().Be(user.Id);
        stored.UserDeviceId.Should().Be(device.Id);
        stored.IpAddress.Should().Be(Ip);
        stored.UserAgent.Should().Be(UserAgent);
        stored.ExpiresAt.Should().BeAfter(DateTime.UtcNow);

        _refreshTokenRepo.Verify(
            r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateTokenPairAsync_WhenExistingActiveTokensOnDevice_ShouldRevokeThemBeforeIssuingNew()
    {
        // Arrange — én aktiv token på devicen fra en tidligere sesjon (f.eks. krasj)
        var user   = MakeUser();
        var device = MakeDevice();

        var existing = new RefreshToken
        {
            UserId       = user.Id,
            UserDeviceId = device.Id,
            IsRevoked    = false,
        };
        _refreshTokenRepo
            .Setup(r => r.GetActiveTokensByDeviceIdAsync(device.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RefreshToken> { existing });

        // Act
        await _sut.GenerateTokenPairAsync(user, device, new List<string>(), Ip, UserAgent);

        // Assert — den gamle tokenen er revokert med riktig grunn
        existing.IsRevoked.Should().BeTrue();
        existing.RevokedReason.Should().Be("Replaced by new login");
    }
}
