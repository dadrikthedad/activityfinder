namespace AFBack.Features.Auth.Services.Interfaces;

public interface ILoginHistoryService
{
    /// <summary>
    /// Oppretter en LoginHistory ved innlogging for historikk for sikkerhetshensyn.
    /// Logger brukeren plutselig inn i Kina/India/Russland, så må de få varsel om det
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="deviceId">Enhetens ID</param>
    /// <param name="ipAddress">Brukerens IP-addresse</param>
    /// <param name="userAgent">USerAgent til nettleseren hvis den er med</param>
    /// <param name="ct"></param>
    Task RecordLoginAsync(string userId, int deviceId, string ipAddress, string? userAgent,
        CancellationToken ct = default);
    
    /// <summary>
    /// Oppdaterer en LoginHistory med øyeblikket brukeren logget ut
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="deviceId">Enhetens ID</param>
    Task RecordLogoutAsync(string userId, int deviceId);

    /// <summary>
    /// Oppdaterer alle LoginHistorier med utlogget tidspunkt
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    Task RecordLogoutAllAsync(string userId);
}
