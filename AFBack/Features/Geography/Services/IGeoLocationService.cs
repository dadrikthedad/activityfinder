

using AFBack.Common.Results;
using AFBack.Features.Geography.DTOs;

namespace AFBack.Features.Geography.Services;

public interface IGeoLocationService
{
    /// <summary>
    /// Henter City, Regiono og Country utifra brukerens IPAddresse
    /// </summary>
    /// <param name="ipAddress">IP-addressen til brukeren</param>
    /// <param name="ct"></param>
    /// <returns>GeolocationResponse med city, country og region</returns>
    Task<Result<GeolocationResponse>> GetLocationAsync(string ipAddress, CancellationToken ct = default);
}
