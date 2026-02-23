using AFBack.Common.DTOs;
using AFBack.DTOs;

namespace AFBack.Cache;

public interface IUserSummaryCacheService
{
    /// <summary>
    /// Henter en UserSummary til bruker fra cache, eller fra databasen og setter til cache
    /// </summary>
    /// <param name="userId">Brukeren vvi skal hente UserSummary til</param>
    /// <returns>UserSummaryDto eller null hvis miss fra databasen</returns>
    Task<UserSummaryDto?> GetUserSummaryAsync(string userId);

    /// <summary>
    /// Henter flere UserSummary til brukere fra cache, eller fra databasen og setter til cache
    /// </summary>
    /// <param name="userIds">Liste med brukere</param>
    /// <returns>Ordbok med Key = userId, Value = UserSummaryDto</returns>
    Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds);

    
    /// <summary>
    /// Invaliderer en brukers UserSummary
    /// </summary>
    Task InvalidateUserSummaryAsync(string userId);

    /// <summary>
    /// Oppdaterer en brukers cache ved feks endringer av navn eller bilde
    /// </summary>
    Task RefreshUserSummaryAsync(string userId);
}
