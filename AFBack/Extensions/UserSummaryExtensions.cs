using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;


namespace AFBack.Extensions;

public static class UserSummaryExtensions
{
    // Henter alt med kun UserId
    public static async Task<UserSummaryDTO?> GetUserSummaryWithRelationshipAsync(
        ApplicationDbContext context,
        int targetUserId,
        int currentUserId)
    {
        var currentTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Hent bruker med profil i én query
        var user = await context.Users
            .Include(u => u.Profile)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == targetUserId);

        if (user == null)
            return null; // Bruker finnes ikke

        // Sjekk friendship (bidirectional)
        var isFriend = await context.Friends
            .AnyAsync(f => (f.UserId == currentUserId && f.FriendId == targetUserId) ||
                           (f.UserId == targetUserId && f.FriendId == currentUserId));

        // Sjekk block relationships
        var blockRelationships = await context.UserBlock
            .Where(b => (b.BlockerId == currentUserId && b.BlockedUserId == targetUserId) ||
                        (b.BlockerId == targetUserId && b.BlockedUserId == currentUserId))
            .Select(b => new { b.BlockerId, b.BlockedUserId })
            .ToListAsync();

        // Beregn block status i begge retninger
        bool? isBlocked = blockRelationships.Any(b => b.BlockerId == currentUserId) ? true : null;
        bool? hasBlockedMe = blockRelationships.Any(b => b.BlockerId == targetUserId) ? true : null;

        return new UserSummaryDTO
        {
            Id = user.Id,
            FullName = user.FullName,
            ProfileImageUrl = user.Profile?.ProfileImageUrl,
            GroupRequestStatus = null,
            isFriend = isFriend ? true : null,
            isBlocked = isBlocked,
            hasBlockedMe = hasBlockedMe,
            LastUpdated = currentTimestamp
        };
    }
    
    public static async Task<UserSummaryDTO> MapToUserSummaryWithRelationshipAsync(
        ApplicationDbContext context,
        int targetUserId,
        string fullName,
        string? profileImageUrl,
        int currentUserId)
    {
        var currentTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Sjekk friendship (bidirectional)
        var isFriend = await context.Friends
            .AnyAsync(f => (f.UserId == currentUserId && f.FriendId == targetUserId) ||
                           (f.UserId == targetUserId && f.FriendId == currentUserId));

        // Sjekk block relationships (mer detaljert enn bootstrap)
        var blockRelationships = await context.UserBlock
            .Where(b => (b.BlockerId == currentUserId && b.BlockedUserId == targetUserId) ||
                        (b.BlockerId == targetUserId && b.BlockedUserId == currentUserId))
            .Select(b => new { b.BlockerId, b.BlockedUserId })
            .ToListAsync();

        // Beregn block status i begge retninger
        bool? isBlocked = blockRelationships.Any(b => b.BlockerId == currentUserId) ? true : null;
        bool? hasBlockedMe = blockRelationships.Any(b => b.BlockerId == targetUserId) ? true : null;

        return new UserSummaryDTO
        {
            Id = targetUserId,
            FullName = fullName,
            ProfileImageUrl = profileImageUrl,
            GroupRequestStatus = null, // Not relevant for friend invitations
            isFriend = isFriend ? true : null,
            isBlocked = isBlocked,
            hasBlockedMe = hasBlockedMe,
            LastUpdated = currentTimestamp
        };
    }
    
    public static void NotifyFriendsAndBlockersOfProfileUpdate(
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    int userId, 
    List<string> updatedFields, 
    Dictionary<string, object> updatedValues) // 🆕 Kun endrede verdier
    {
        taskQueue.QueueAsync(async () => 
        {
            using var scope = scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<UserHub>>(); 

            try 
            {
                // Hent alle venner (begge retninger)
                var friendIds = await context.Friends
                    .Where(f => f.UserId == userId || f.FriendId == userId)
                    .Select(f => f.UserId == userId ? f.FriendId : f.UserId)
                    .ToListAsync();

                // Hent brukere som har blokkert denne brukeren
                var blockerIds = await context.UserBlock
                    .Where(ub => ub.BlockedUserId == userId)
                    .Select(ub => ub.BlockerId)
                    .ToListAsync();

                // Kombiner og fjern duplikater
                var usersToNotify = friendIds.Union(blockerIds).ToList();

                if (usersToNotify.Any())
                {
                    var eventData = new
                    {
                        userId = userId,
                        updatedFields = updatedFields,
                        updatedValues = updatedValues, // 🎯 Kun endrede verdier
                        updatedAt = DateTime.UtcNow
                    };

                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.USER_PROFILE_UPDATED,
                        eventData: eventData,
                        targetUserIds: usersToNotify, // 🎯 Broadcast til alle
                        source: "API",
                        relatedEntityId: userId,
                        relatedEntityType: "User"
                    );
                    
                    // 🆕 Send SignalR til alle relevante brukere
                    var userIdStrings = usersToNotify.Select(id => id.ToString()).ToList();
                    await hubContext.Clients.Users(userIdStrings)
                        .SendAsync("UserProfileUpdated", eventData);

                    Console.WriteLine($"✅ Profile update sent to {usersToNotify.Count} users via sync + SignalR");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to create sync event for profile update. UserId: {userId}, Error: {ex.Message}");
            }
        });
    }
}
