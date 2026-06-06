using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using AFBack.Features.Geography.DTOs;
using AFBack.Features.Geography.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class LoginHistoryServiceTests
{
    private readonly Mock<ILoginHistoryRepository> _repository;
    private readonly Mock<IGeoLocationService>     _geo;
    private readonly LoginHistoryService           _sut;

    private const string UserId    = "user-guid-123";
    private const string Ip        = "10.0.0.1";
    private const string UserAgent = "TestAgent/1.0";

    public LoginHistoryServiceTests()
    {
        _repository = new Mock<ILoginHistoryRepository>();
        _geo        = new Mock<IGeoLocationService>();

        _sut = new LoginHistoryService(
            Mock.Of<ILogger<LoginHistoryService>>(),
            _repository.Object,
            _geo.Object);
    }

    // ======================== RecordLoginAsync ========================

    [Fact]
    public async Task RecordLoginAsync_WhenGeoSucceeds_ShouldSetLocationAndPersistEntry()
    {
        // Arrange
        _geo
            .Setup(g => g.GetLocationAsync(Ip, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<GeolocationResponse>.Success(new GeolocationResponse
            {
                City    = "Oslo",
                Region  = "Oslo",
                Country = "NO",
            }));

        LoginHistory? captured = null;
        _repository
            .Setup(r => r.AddAsync(It.IsAny<LoginHistory>()))
            .Callback<LoginHistory>(entry => captured = entry);

        // Act
        await _sut.RecordLoginAsync(UserId, deviceId: 1, Ip, UserAgent);

        // Assert
        captured.Should().NotBeNull();
        captured!.UserId.Should().Be(UserId);
        captured.IpAddress.Should().Be(Ip);
        captured.UserAgent.Should().Be(UserAgent);
        captured.City.Should().Be("Oslo");
        captured.Country.Should().Be("NO");
    }

    [Fact]
    public async Task RecordLoginAsync_WhenGeoFails_ShouldPersistEntryWithNullLocation()
    {
        // Arrange — geo-tjenesten er utilgjengelig
        _geo
            .Setup(g => g.GetLocationAsync(Ip, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<GeolocationResponse>.Failure(
                "Geolocation service unavailable", AppErrorCode.InternalError));

        LoginHistory? captured = null;
        _repository
            .Setup(r => r.AddAsync(It.IsAny<LoginHistory>()))
            .Callback<LoginHistory>(entry => captured = entry);

        // Act
        await _sut.RecordLoginAsync(UserId, deviceId: 1, Ip, UserAgent);

        // Assert — oppføringen lagres, men uten lokasjon
        captured.Should().NotBeNull();
        captured!.City.Should().BeNull();
        captured.Region.Should().BeNull();
        captured.Country.Should().BeNull();

        _repository.Verify(r => r.AddAsync(It.IsAny<LoginHistory>()), Times.Once);
    }
}
