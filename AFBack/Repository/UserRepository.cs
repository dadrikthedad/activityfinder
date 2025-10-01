using System.Collections;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Interface.Repository;

public class UserRepository : IUserRepository
{

    private readonly ApplicationDbContext _context;
    
    public UserRepository(ApplicationDbContext context)
    {
        _context = context;
    }
    
    // Ikke brukt enda
    /// <summary>
    /// Sjekker om brukeren finnes i databasen. Bruker egentlig Cache for dette
    /// </summary>
    /// <param name="userId"></param>
    /// <returns></returns>
    public async Task<bool> UserExistsAsync(int userId) => 
        await _context.Users.AsNoTracking().AnyAsync(u => u.Id == userId);
    
    /// <summary>
    /// Henter alle brukere tilhørenende en liste og returner en ordbok med key = UserId og value = user.FulleName og
    /// user.ProfileImageUrl
    /// </summary>
    /// <param name="userIds"></param>
    /// <returns></returns>
    public async Task<Dictionary<int, (string FullName, string? ProfileImageUrl)>> 
        GetUserSummaries(IEnumerable<int> userIds)
    {
        return await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(user => new { user.Id, user.FullName, user.ProfileImageUrl })
            .ToDictionaryAsync(user => user.Id, user => (user.FullName, user.ProfileImageUrl));
    }
}