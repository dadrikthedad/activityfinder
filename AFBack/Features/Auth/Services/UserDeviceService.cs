using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services.Interfaces;

namespace AFBack.Features.Auth.Services;

public class UserDeviceService(
    ILogger<UserDeviceService> logger,
    IUserDeviceRepository userDeviceRepository) : IUserDeviceService
{
    
    public async Task<UserDevice> ResolveOrCreateDeviceAsync(string userId, DeviceInfoRequest deviceInfoRequest, 
        string ipAddress, CancellationToken ct = default)
    {
        // Henter UserDevice med brukerId og fingerprint
        var device = await userDeviceRepository.GetByFingerprintAsync(userId, deviceInfoRequest.DeviceFingerprint, ct);
        
        // Device allerede eksisterer - vi oppdaterer eksisterende
        if (device != null)
        {
            // Oppdater metadata for eksisterende device
            device.LastUsedAt = DateTime.UtcNow;
            device.LastIpAddress = ipAddress;
            device.DeviceName = deviceInfoRequest.DeviceName; // Kan ha endret seg
        
            await userDeviceRepository.SaveChangesAsync(ct);
        
            logger.LogInformation("Existing device resolved. DeviceId: {DeviceId}", device.Id);
            return device;
        }
    
        // Opprett ny device
        device = new UserDevice
        {
            UserId = userId,
            DeviceFingerprint = deviceInfoRequest.DeviceFingerprint,
            DeviceName = deviceInfoRequest.DeviceName,
            DeviceType = deviceInfoRequest.DeviceType,
            OperatingSystem = deviceInfoRequest.OperatingSystem,
            Browser = deviceInfoRequest.Browser,
            LastIpAddress = ipAddress,
            FirstSeenAt = DateTime.UtcNow,
            LastUsedAt = DateTime.UtcNow,
            IsTrusted = false
        };
    
        await userDeviceRepository.AddAsync(device, ct);
    
        logger.LogInformation("New device registered. DeviceId: {DeviceId}, Name: {DeviceName}",
            device.Id, device.DeviceName);
    
        return device;
    }
}
