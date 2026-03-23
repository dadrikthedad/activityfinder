using AFBack.Common.DTOs;
using AFBack.Features.Auth.Models;

namespace AFBack.Features.Auth.Repositories;

public interface IUserRepository
{
    /// <summary>
    /// Rask sjekk om en bruker eksisterer
    /// </summary>
    /// <param name="userId">BrukerId</param>
    /// <param name="ct"></param>
    /// <returns>True hvis bruker eksisterer, false hvis ingen bruker</returns>
    Task<bool> UserExistsAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Henter en User med Profile og Settings
    /// </summary>
    /// <param name="userId">Brukeren vi henter</param>
    /// <param name="ct"></param>
    /// <returns>AppUser eller null</returns>
    Task<AppUser?> GetUserWithProfileAndSettingsAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Finner en bruker utifra telefonnr
    /// </summary>
    /// <param name="phoneNumber">Telefonnummer brukeren foreslår</param>
    /// <param name="ct"></param>
    /// <returns>En bruker eller null hvis null resultat</returns>
    Task<AppUser?> FindByPhoneAsync(string phoneNumber, CancellationToken ct = default);
    
    /// <summary>
    /// Henter ikke-verifisierte brukere
    /// </summary>
    /// <param name="nothingVerifiedCutoff">DateTime for brukere som ikke er verifisert i det hele tatt</param>
    /// <param name="partiallyVerifiedCutoff">DateTime for brukere som har verifisert epost, men ikke tlf</param>
    /// <param name="ct"></param>
    /// <returns>Liste med AppUser</returns>
    Task<List<AppUser>> GetUnverifiedUsersAsync(DateTime nothingVerifiedCutoff, DateTime partiallyVerifiedCutoff,
        CancellationToken ct = default);

    /// <summary>
    /// Henter UserSummary til en bruker
    /// </summary>
    /// <param name="userId">Bruker ID-for å hente summary</param>
    /// <param name="ct"></param>
    /// <returns>UserSummaryDto eller null</returns>
    Task<UserSummaryDto?> GetUserSummaryAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Henter UserSummary til mange brukere
    /// </summary>
    /// <param name="userIds">En liste med UserId-strenger</param>
    /// <param name="ct"></param>
    /// <returns>Dictionary med Key = userId, Value = UserSummaryDto</returns>
    Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds, 
        CancellationToken ct = default);
}
