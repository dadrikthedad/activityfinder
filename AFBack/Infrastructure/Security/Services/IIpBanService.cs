using AFBack.Constants;

namespace AFBack.Infrastructure.Security.Services;

public interface IIpBanService
{
    /// <summary>
    /// Banner en IP-adresse. Sjekker om det er en eksisterende IpBan på denne addressen, og forlenger den
    /// eller oppretter ny. Er brukeren autorisert så banner vi brukeren med Identity like lenge som IpBan
    /// </summary>
    /// <param name="ipAddress">Normalisert IP-adresse</param>
    /// <param name="banType">Permanent eller midlertidig</param>
    /// <param name="reason">Årsak til banning</param>
    /// <param name="userId">Autoriserte brukere har med brukerId</param>
    /// <param name="bannedBy">Hvem/hva som initierte banningen</param>
    Task BanIpAsync(string ipAddress, BanType banType, string reason, string? userId = null,
        string bannedBy = "System");
    
    /// <summary>
    /// Fjerner ban for en IP-adresse. Deaktiverer i database og oppdaterer cache.
    /// </summary>
    /// <param name="ipAddress">Normalisert IP-adresse</param>
    Task UnbanIpAsync(string ipAddress);
    
    /// <summary>
    /// Sjekker om en IP er whitelisted. Støtter både enkelt-IP-er og CIDR-ranges.
    /// </summary>
    /// <param name="ipAddress">IP-adressen vi skal sjekke</param>
    /// <returns>True hvis IP eller CIDR-range er whitelisted, false hvis ikke whitelsited</returns>
    bool IsWhitelisted(string ipAddress);
    
    /// <summary>
    /// Sjekker om en IP-adresse er bannet. Bruker cache for rask oppslag.
    /// </summary>
    /// <param name="ipAddress">IP-addressen vi skal sjekke</param>
    /// <returns>True hvis den er banned, og false hvis ikke</returns>
    Task<bool> IsIpBannedAsync(string? ipAddress);
}
