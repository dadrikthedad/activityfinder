using System.Collections;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Interface.Repository;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Repository;

public class UserRepository(ApplicationDbContext context) : IUserRepository
{
    // Ikke brukt enda
    /// <summary>
    /// Sjekker om brukeren finnes i databasen. Bruker egentlig Cache for dette
    /// </summary>
    /// <param name="userId"></param>
    /// <returns></returns>
    public async Task<bool> UserExistsAsync(string userId) => 
        await context.AppUsers.AsNoTracking().AnyAsync(u => u.Id == userId);
    
    /// <summary>
    /// Henter alle brukere tilhørenende en liste og returner en ordbok med key = UserId og value = appUser.FulleName og
    /// appUser.ProfileImageUrl
    /// </summary>
    /// <param name="userIds"></param>
    /// <returns></returns>
    public async Task<Dictionary<int, (string FullName, string? ProfileImageUrl)>> GetUserSummaries(
        IEnumerable<int> userIds) => 
        await context.AppUsers
            .Where(u => userIds.Contains(u.Id))
            .Select(user => new { user.Id, user.FullName, user.ProfileImageUrl })
            .ToDictionaryAsync(user => user.Id, user => (user.FullName, user.ProfileImageUrl));



    public async Task<UserSummaryDto?> GetUserSummaryAsync(string userId) =>
        await context.AppUsers
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .SingleOrDefaultAsync();

    public async Task<Dictionary<string, UserSummaryDto>> GetUserSummariesAsync(List<string> userIds) =>
        await context.AppUsers
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .ToDictionaryAsync(u => u.Id, u => u);
        

}
