using AFBack.Features.Profile.Models;

namespace AFBack.Features.Profile.Repository;

public interface IProfileRepository
{
    /// <summary>
    /// Henter Profile til en bruker
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>UserProfile eller null</returns>
    Task<UserProfile?> GetProfileByUserAsync(string userId);
    
    /// <summary>
    /// Henter Profile med tilhørende AppUser og UserSettings (for offentlig visning)
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>UserProfile eller null</returns>
    Task<UserProfile?> GetProfileWithNavigationsAsync(string userId);

    Task SaveChangesAsync();
}
