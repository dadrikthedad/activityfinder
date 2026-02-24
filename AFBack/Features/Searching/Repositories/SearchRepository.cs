using AFBack.Data;
using AFBack.Features.Searching.DTOs.Responses;
using AFBack.Features.Searching.Enum;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Searching.Repositories;

public class SearchRepository(AppDbContext context) : ISearchRepository
{   
    
    /// <inheritdoc/>
    public async Task<List<UserSearchResult>> SearchUsersAsync(
        string searchQuery, string requestingUserId, string? cursor, int pageSize)
    {
        // Hent søkerens lokasjon for nærhet-scoring
        var requestingProfile = await context.Profiles
            .AsNoTracking()
            .Where(p => p.UserId == requestingUserId)
            .Select(p => new { p.PostalCode, p.City, p.Region, p.CountryCode })
            .FirstOrDefaultAsync();

        var normalizedQuery = searchQuery.ToLower().Trim();
        
        // Brukere som har blokkert oss, filtreres bort
        var blockedRequestingUserIds = context.UserBlocks
            .Where(b => b.BlockedUserId == requestingUserId)
            .Select(b => b.BlockerId);

        var dbQuery = context.Users
            .AsNoTracking()
            .Where(u => u.Id != requestingUserId) // Filtrer bort sender selv
            .Where(u => !blockedRequestingUserIds.Contains(u.Id)) 
            .Where(u => u.FullName.ToLower().Contains(normalizedQuery))
            .Join(context.Profiles, // Må ha Profiles-tabellen for lokasjon
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
                    // Først sjekker vi at Country er korrekt, der etter sjekker vi at brukeren sin 
                    // PostalCode stemmer med myProfile
                    (x.Profile.CountryCode == requestingProfile!.CountryCode 
                    && requestingProfile.PostalCode != null
                    && x.Profile.PostalCode == requestingProfile.PostalCode)
                        ? (int)ProximityLevel.PostalCode : // Hvis true = 0 ProximityLevel
                        // Eller så sjekker vi at City stemmer med brukerens City
                        x.Profile.CountryCode == requestingProfile.CountryCode 
                        && requestingProfile.City != null
                        && x.Profile.City == requestingProfile.City
                            ? (int)ProximityLevel.City : // Hvis true = 1 ProximityLevel
                            // Eller så sjekker vi Region
                            x.Profile.CountryCode == requestingProfile.CountryCode
                            && x.Profile.Region == requestingProfile.Region
                                ? (int)ProximityLevel.Region : // Hvis true = 2 ProximityLevel
                                x.Profile.CountryCode == requestingProfile.CountryCode
                                    ? (int)ProximityLevel.Country // Hvis Country true = 3 ProximityLevel
                                    : (int)ProximityLevel.Other // Eller så er det 4 ProximityLevel
            });

        // Cursor: "proximityLevel|fullName|userId"
        // Brukes til å huske hvor vi er i søket
        if (!string.IsNullOrEmpty(cursor))
        {
            var parts = cursor.Split('|');
            // Sjekker at det er 3 deler i arrayet og at første del kan parses til en int
            if (parts.Length == 3 && int.TryParse(parts[0], out var cursorLevel)) 
            {
                var cursorName = parts[1];
                var cursorId = parts[2];
                // Nå skal vi hente alle som kommer etter cursoren vi har sendt inn
                dbQuery = dbQuery.Where(x =>
                    // Henter først alle som er lengre unna enn Cursor
                    x.ProximityLevel > cursorLevel ||
                    // Deretter henter vi de med samme ProximityLevel, men alfabatisk etter Cursor-navnet
                    (x.ProximityLevel == cursorLevel && x.FullName.CompareTo(cursorName) > 0) ||
                    // Og til slutt så sorterer vi etter ID, slik at de med likt navn kommer i forskjellig rekkefølge
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
            .Where(u => u.Id != requestingUserId) // Filtrer bort søkeren
            .Where(u => !blockedRequestingUserIds.Contains(u.Id)) 
            .Where(u => u.FullName.ToLower().Contains(normalizedQuery));

        if (!string.IsNullOrEmpty(cursor))
        {
            dbQuery = dbQuery.Where(u =>
                // Her henter vi brukere med FullName som kommer etter cursor alfabetisk
                u.FullName.CompareTo(context.Users
                        .Where(c => c.Id == cursor)
                        .Select(c => c.FullName)
                        .FirstOrDefault()!) > 0
                // Og hvis navnene mellom bruke er like, velg den med ID-en som kommer etter cursor-id
                || (u.FullName == context.Users
                        .Where(c => c.Id == cursor)
                        .Select(c => c.FullName).
                        FirstOrDefault()!
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
            // Vi filtreret bort eksisterende medlemmer
             existingMemberIds = context.ConversationParticipants
                .Where(cp => cp.ConversationId == conversationId)
                .Select(cp => cp.UserId);
             
             // Vi filtreret bort brukere som har forlatt samtalen
             leftMemberIds = context.ConversationLeftRecords
                 .Where(lr => lr.ConversationId == conversationId)
                 .Select(lr => lr.UserId);
        }
        

        // Filtrerer borte blokkerte brukere og brukere som har blokkert brukeren
        var blockedByMe = context.UserBlocks
            .Where(b => b.BlockerId == requestingUserId)
            .Select(b => b.BlockedUserId);

        var blockedMe = context.UserBlocks
            .Where(b => b.BlockedUserId == requestingUserId)
            .Select(b => b.BlockerId);
        
        // Venn-IDer for sortering
        var friendIds = context.Friendships
            .Where(f => f.UserId == requestingUserId || f.FriendId == requestingUserId)
            .Select(f => f.UserId == requestingUserId ? f.FriendId : f.UserId);

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
        
        // Legg til IsFriend for sortering
        var sortedQuery = dbQuery.Select(u => new
        {
            User = u,
            IsFriend = friendIds.Contains(u.Id) ? 0 : 1 // 0 = venn først
        });

        // Cursor: "isFriend|fullName|userId"
        if (!string.IsNullOrEmpty(cursor))
        {
            var parts = cursor.Split('|');
            if (parts.Length == 3 && int.TryParse(parts[0], out var cursorFriend))
            {
                var cursorName = parts[1];
                var cursorId = parts[2];
                sortedQuery = sortedQuery.Where(x =>
                    x.IsFriend > cursorFriend ||
                    (x.IsFriend == cursorFriend && x.User.FullName.CompareTo(cursorName) > 0) ||
                    (x.IsFriend == cursorFriend && x.User.FullName == cursorName
                                                && x.User.Id.CompareTo(cursorId) > 0));
            }
        }

        return await sortedQuery
            .OrderBy(x => x.IsFriend)
            .ThenBy(x => x.User.FullName)
            .ThenBy(x => x.User.Id)
            .Take(pageSize + 1)
            .Select(x => new UserSearchResult
            {
                Id = x.User.Id,
                FullName = x.User.FullName,
                ProfileImageUrl = x.User.ProfileImageUrl,
                IsFriend = x.IsFriend == 0
            })
            .ToListAsync();
    }
}
