using AFBack.Features.Auth.Models;
using AFBack.Infrastructure.Security.Models;

namespace AFBack.Infrastructure.Security.Repositories;

public interface IIpBanRepository
{
    /// <summary>
    /// Henter aktive IpBans
    /// </summary>
    /// <returns>En liste med Ipbans eller tom liste</returns>
    Task<List<IpBan>> GetAllActiveAsync();
    
    /// <summary>
    /// Henter om en IP-adresse er bannet
    /// </summary>
    /// <param name="ipAddress">IP-adressen vi sjekker</param>
    /// <returns>IpBan eller null hvis ikke bannet</returns>
    Task<IpBan?> GetByIpAsync(string ipAddress);
    
    /// <summary>
    /// Henter UserDevice med brukerId og deviceFingerprint
    /// </summary>
    /// <param name="userId">Brukeren sin Device vi skal hente</param>
    /// <param name="deviceFingerprint">DeviceFingerprint satt i frontend</param>
    /// <returns>UserDevice eller null</returns>
    Task<UserDevice?> GetUserDeviceIdAsync(string userId, string deviceFingerprint);

    
    /// <summary>
    /// Lagrerer en IpBan i databasen
    /// </summary>
    Task AddIpBanAsync(IpBan ipBan);
    
    /// <summary>
    /// Deaktiviterer en midltertidig ban ved å endre IsActive til false. Permantente og bans som ikke har utløpt
    /// ikke berørt
    /// </summary>
    /// <param name="ipAddress">IP-adressen som ikke er midlertidig bannet lengre</param>
    /// <returns></returns>
    Task<int> DeactivateIpBanAsync(string ipAddress);
    
    Task SaveChangesAsync();
}
