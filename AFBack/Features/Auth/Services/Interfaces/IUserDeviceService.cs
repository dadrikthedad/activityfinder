using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Services.Interfaces;

public interface IUserDeviceService
{
    /// <summary>
    /// Finner eksisterende device basert på fingerprint, eller oppretter ny.
    /// Oppdaterer device-metadata ved pålogging.
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <param name="deviceInfoRequest"></param>
    /// <param name="ipAddress">IP-addressen til brukeren</param>
    /// <param name="ct"></param>
    /// <returns></returns>
    Task<UserDevice> ResolveOrCreateDeviceAsync(string userId, DeviceInfoRequest deviceInfoRequest,
        string ipAddress, CancellationToken ct = default);
}
