using AFBack.Infrastructure.Security.Models;

namespace AFBack.Infrastructure.Security.Repositories;

public interface ISuspiciousActivityRepository
{
    /// <summary>
    /// Henter mistenksomme aktiviterer utifra et satt vindu til en IP-adresse
    /// </summary>
    /// <param name="ipAddress"> IP-adressen som har utført en mistenksom handling</param>
    /// <param name="suspiciousWindowStart">Tidsvinduet hendelsen må ha vært innen</param>
    /// <returns>En int med antall</returns>
    Task<int> GetSuspiciousActivitiesCountAsync(string ipAddress, DateTime suspiciousWindowStart);
    
    /// <summary>
    /// Lagrerer en SuspiciousActivity i databasen
    /// </summary>
    Task AddSuspiciousActivity(SuspiciousActivity suspiciousActivity);
}
