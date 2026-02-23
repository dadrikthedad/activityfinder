using AFBack.Data;
using AFBack.Features.Searching.DTOs.Responses;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Searching.Repositories;

public class SearchRepository(AppDbContext context) : ISearchRepository
{
    public async Task<List<UserSearchResult>> SearchUsersAsync(
        string query, string requestingUserId, string? cursor, int pageSize)
    {
        // Hent søkerens lokasjon for nærhet-scoring
        var myProfile = await context.Profiles
            .AsNoTracking()
            .Where(p => p.UserId == requestingUserId)
            .Select(p => new { p.PostalCode, p.City, p.Region, p.CountryCode })
            .FirstOrDefaultAsync();

        var normalizedQuery = query.ToLower().Trim();

        var dbQuery = context.Users
            .AsNoTracking()
            .Where(u => u.Id != requestingUserId)
            .Where(u => u.FullName.ToLower().Contains(normalizedQuery))
            .Join(context.Profiles,
                u => u.Id,
                p => p.UserId,
                (u, p) => new { User = u, Profile = p })
            .Select(x => new UserSearchResult
            {
                Id = x.User.Id,
                FullName = x.User.FullName,
                ProfileImageUrl = x.User.ProfileImageUrl,
                City = x.Profile.City,
                Region = x.Profile.Region,
                CountryCode = x.Profile.CountryCode,
                ProximityLevel =
                    myProfile != null && myProfile.PostalCode != null
                        && x.Profile.PostalCode == myProfile.PostalCode ? 0 :
                    myProfile != null && myProfile.City != null
                        && x.Profile.City == myProfile.City ? 1 :
                    myProfile != null && x.Profile.Region == myProfile.Region ? 2 :
                    myProfile != null && x.Profile.CountryCode == myProfile.CountryCode ? 3 : 4
            });

        // Cursor: "proximityLevel|userId"
        if (!string.IsNullOrEmpty(cursor))
        {
            var parts = cursor.Split('|');
            if (parts.Length == 2 && int.TryParse(parts[0], out var cursorLevel))
            {
                var cursorId = parts[1];
                dbQuery = dbQuery.Where(x =>
                    x.ProximityLevel > cursorLevel ||
                    (x.ProximityLevel == cursorLevel && x.Id.CompareTo(cursorId) > 0));
            }
        }

        return await dbQuery
            .OrderBy(x => x.ProximityLevel)
            .ThenBy(x => x.FullName)
            .ThenBy(x => x.Id)
            .Take(pageSize + 1) // +1 for å sjekke HasMore
            .ToListAsync();
    }
    
    public async Task<List<UserSearchResult>> QuickSearchUsersAsync(
        string query, string requestingUserId, string? cursor, int pageSize)
    {
        var normalizedQuery = query.ToLower().Trim();

        var dbQuery = context.Users
            .AsNoTracking()
            .Where(u => u.Id != requestingUserId)
            .Where(u => u.FullName.ToLower().Contains(normalizedQuery));

        if (!string.IsNullOrEmpty(cursor))
        {
            dbQuery = dbQuery.Where(u =>
                u.FullName.CompareTo(
                    context.Users.Where(c => c.Id == cursor).Select(c => c.FullName).FirstOrDefault()!) > 0
                || (u.FullName == context.Users.Where(c => c.Id == cursor).Select(c => c.FullName).FirstOrDefault()!
                    && u.Id.CompareTo(cursor) > 0));
        }

        return await dbQuery
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.Id)
            .Take(pageSize + 1)
            .Select(u => new UserSearchResult
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .ToListAsync();
    }
}
