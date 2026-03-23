using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface IUserDeviceRepository
{
    /// <summary>
    /// Finner en device basert på bruker og fingerprint.
    /// Returnerer null hvis devicen ikke er registrert.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="deviceFingerprint"> Devicefingerprint fra frontend</param>
    /// <param name="ct"></param>
    /// <returns></returns>
    Task<UserDevice?> GetByFingerprintAsync(string userId, string deviceFingerprint, CancellationToken ct = default);
    
    Task AddAsync(UserDevice device, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
