using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Enums;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace AFBack.Tests.Features.Auth;

public class UserDeviceServiceTests
{
    private readonly Mock<IUserDeviceRepository> _repository;
    private readonly UserDeviceService           _sut;

    private const string UserId      = "user-guid-123";
    private const string Fingerprint = "fp-abc123";
    private const string Ip          = "10.0.0.1";

    private static readonly DeviceInfoRequest DeviceInfo = new()
    {
        DeviceFingerprint = Fingerprint,
        DeviceName        = "Test Device",
        DeviceType        = DeviceType.Unknown,
        OperatingSystem   = OperatingSystemType.Unknown,
    };

    public UserDeviceServiceTests()
    {
        _repository = new Mock<IUserDeviceRepository>();
        _sut = new UserDeviceService(Mock.Of<ILogger<UserDeviceService>>(), _repository.Object);
    }

    // ======================== Eksisterende device ========================

    [Fact]
    public async Task ResolveOrCreateDeviceAsync_WhenDeviceExists_ShouldUpdateMetadataAndReturnExistingDevice()
    {
        // Arrange
        var existingDevice = new UserDevice
        {
            Id                = 42,
            UserId            = UserId,
            DeviceFingerprint = Fingerprint,
            DeviceName        = "Gammelt navn",
            LastUsedAt        = DateTime.UtcNow.AddDays(-7),
            LastIpAddress     = "1.2.3.4",
        };
        _repository
            .Setup(r => r.GetByFingerprintAsync(UserId, Fingerprint, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingDevice);

        var before = DateTime.UtcNow;

        // Act
        var result = await _sut.ResolveOrCreateDeviceAsync(UserId, DeviceInfo, Ip);

        // Assert
        result.Id.Should().Be(42);
        result.DeviceName.Should().Be(DeviceInfo.DeviceName);
        result.LastIpAddress.Should().Be(Ip);
        result.LastUsedAt.Should().BeOnOrAfter(before);

        _repository.Verify(r => r.AddAsync(It.IsAny<UserDevice>(), It.IsAny<CancellationToken>()), Times.Never);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ======================== Ny device ========================

    [Fact]
    public async Task ResolveOrCreateDeviceAsync_WhenDeviceIsNew_ShouldCreateAndReturnDevice()
    {
        // Arrange — ingen eksisterende device
        _repository
            .Setup(r => r.GetByFingerprintAsync(UserId, Fingerprint, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserDevice?)null);

        var before = DateTime.UtcNow;

        // Act
        var result = await _sut.ResolveOrCreateDeviceAsync(UserId, DeviceInfo, Ip);

        // Assert
        result.UserId.Should().Be(UserId);
        result.DeviceFingerprint.Should().Be(Fingerprint);
        result.DeviceName.Should().Be(DeviceInfo.DeviceName);
        result.LastIpAddress.Should().Be(Ip);
        result.FirstSeenAt.Should().BeOnOrAfter(before);
        result.IsTrusted.Should().BeFalse();

        _repository.Verify(
            r => r.AddAsync(It.Is<UserDevice>(d => d.DeviceFingerprint == Fingerprint),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
