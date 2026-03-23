using AFBack.Data;
using AFBack.Features.Searching.DTOs.Responses;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Searching.Repositories;

public class SearchRepository(AppDbContext context) : ISearchRepository
{
    /// <inheritdoc/>
    public async Task<List<UserSearchResult>> SearchUsersAsync(
        string searchQuery, string requestingUserId, string? cursor, int pageSize)
    {
        var normalizedQuery = searchQuery.ToLower().Trim();

        // Brukere som har blokkert oss, filtreres bort
        var blockedRequestingUserIds = context.UserBlocks
            .Where(b => b.BlockedUserId == requestingUserId)
            .Select(b => b.BlockerId);

        var dbQuery = context.Users
            .AsNoTracking()
            .Where(u => u.Id != requestingUserId)
            .Where(u => !blockedRequestingUserIds.Contains(u.Id))
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
                CountryCode = x.Profile.CountryCode
            });

        // Cursor: "proximityLevel|fullName|userId"
        if (!string.IsNullOrEmpty(cursor))
        {
            var parts = cursor.Split('|');
            if (parts.Length == 3 && int.TryParse(parts[0], out var cursorLevel))
            {
                var cursorName = parts[1];
                var cursorId = parts[2];
                dbQuery = dbQuery.Where(x =>
                    x.ProximityLevel > cursorLevel ||
                    (x.ProximityLevel == cursorLevel && x.FullName.CompareTo(cursorName) > 0) ||
                    (x.ProximityLevel == cursorLevel && x.FullName == cursorName
                                                     && x.Id.CompareTo(cursorId) > 0));
            }
        }

        return await dbQuery
            .OrderBy(x => x.ProximityLevel)
            .ThenBy(x => x.FullName)
            .ThenBy(x => x.Id)
            .Take(pageSize + 1) // +1 for å sjekke HasMore
            .ToListAsync();
    }

    /// <inheritdoc/>
    public async Task<List<UserSearchResult>> QuickSearchUsersAsync(string searchQuery, string requestingUserId,
        string? cursor, int pageSize)
    {
        var normalizedQuery = searchQuery.ToLower().Trim();

        // Brukere som har blokkert oss, filtreres bort
        var blockedRequestingUserIds = context.UserBlocks
            .Where(b => b.BlockedUserId == requestingUserId)
            .Select(b => b.BlockerId);

        var dbQuery = context.Users
            .AsNoTracking()
            .Where(u => u.Id != requestingUserId)
            .Where(u => !blockedRequestingUserIds.Contains(u.Id))
            .Where(u => u.FullName.ToLower().Contains(normalizedQuery));

        if (!string.IsNullOrEmpty(cursor))
        {
            dbQuery = dbQuery.Where(u =>
                u.FullName.CompareTo(context.Users
                    .Where(c => c.Id == cursor)
                    .Select(c => c.FullName)
                    .FirstOrDefault()!) > 0
                || (u.FullName == context.Users
                    .Where(c => c.Id == cursor)
                    .Select(c => c.FullName)
                    .FirstOrDefault()!
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

    /// <inheritdoc/>
    public async Task<List<UserSearchResult>> SearchUsersForGroupInviteAsync(string searchQuery,
        string requestingUserId, int? conversationId, string? cursor, int pageSize)
    {
        var normalizedQuery = searchQuery.ToLower().Trim();

        IQueryable<string>? existingMemberIds = null;
        IQueryable<string>? leftMemberIds = null;

        if (conversationId != null)
        {
            existingMemberIds = context.ConversationParticipants
                .Where(cp => cp.ConversationId == conversationId)
                .Select(cp => cp.UserId);

            leftMemberIds = context.ConversationLeftRecords
                .Where(lr => lr.ConversationId == conversationId)
                .Select(lr => lr.UserId);
        }

        var blockedByMe = context.UserBlocks
            .Where(b => b.BlockerId == requestingUserId)
            .Select(b => b.BlockedUserId);

        var blockedMe = context.UserBlocks
            .Where(b => b.BlockedUserId == requestingUserId)
            .Select(b => b.BlockerId);

        var dbQuery = context.Users
            .AsNoTracking()
            .Where(u => u.Id != requestingUserId)
            .Where(u => !blockedByMe.Contains(u.Id))
            .Where(u => !blockedMe.Contains(u.Id))
            .Where(u => u.FullName.ToLower().Contains(normalizedQuery));

        if (existingMemberIds != null)
            dbQuery = dbQuery.Where(u => !existingMemberIds.Contains(u.Id));

        if (leftMemberIds != null)
            dbQuery = dbQuery.Where(u => !leftMemberIds.Contains(u.Id));

        // Cursor: "fullName|userId"
        if (!string.IsNullOrEmpty(cursor))
        {
            var parts = cursor.Split('|');
            if (parts.Length == 2)
            {
                var cursorName = parts[0];
                var cursorId = parts[1];
                dbQuery = dbQuery.Where(u =>
                    u.FullName.CompareTo(cursorName) > 0 ||
                    (u.FullName == cursorName && u.Id.CompareTo(cursorId) > 0));
            }
        }

        return await dbQuery
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.Id)
            .Take(pageSize + 1)
            .Select(u => new UserSearchResult
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl,
            })
            .ToListAsync();
    }
}
