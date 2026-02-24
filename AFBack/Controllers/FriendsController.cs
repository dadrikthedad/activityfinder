using System.Security.Claims;
using AFBack.Common.DTOs;
using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.SyncEvents.Services;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace AFBack.Controllers;
// Håndterer vennskap mellom to brukere
[ApiController]
[Route("api/friends")]
[Authorize]
public class FriendsController(
    AppDbContext context,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    ILogger<FriendsController> logger)
    : ControllerBase
{
    private readonly ILogger<FriendsController> _logger = logger;


    // GET: Hent alle venner for innlogget bruker, brukes i Friends og skal senere brukes i profilsiden
    [HttpGet]
    public async Task<ActionResult<object>> GetFriends(int pageNumber = 1, int pageSize = 30)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid appUser ID in token." });

        if (pageNumber <= 0 || pageSize <= 0)
            return BadRequest(new { message = "Page number and size must be greater than zero." });

        var query = context.Friendships
            .Include(f => f.User).ThenInclude(u => u.UserProfile)
            .Include(f => f.FriendUser).ThenInclude(u => u.UserProfile)
            .AsNoTracking()
            .Where(f => f.UserId == userId || f.FriendId == userId);

        var totalCount = await query.CountAsync();

        var paginatedFriends = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FriendDTO
            {
                CurrentUserId = userId,
                CreatedAt = f.CreatedAt,
                UserToFriendUserScore = f.UserId == userId ? f.UserToFriendUserScore : f.FriendUserToUserScore,
                FriendUserToUserScore = f.UserId == userId ? f.FriendUserToUserScore : f.UserToFriendUserScore,
                Friend = f.UserId == userId
                    ? new UserSummaryDto
                    {
                        Id = f.FriendUser.Id,
                        FullName = f.FriendUser.FullName,
                        ProfileImageUrl = f.User.ProfileImageUrl
                    }
                    : new UserSummaryDto
                    {
                        Id = f.User.Id,
                        FullName = f.User.FullName,
                        ProfileImageUrl = f.User.ProfileImageUrl
                    }
            })
            .ToListAsync();

        return Ok(new
        {
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize,
            Data = paginatedFriends
        });
    }
    
    // Henter venner til annen bruker
    [HttpGet("of/{userId}")]
    public async Task<ActionResult<List<FriendDTO>>> GetFriendsOfUser(int userId)
    {
        // Henter token til brukeren
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var currentUserId))
            return Unauthorized(new { message = "Invalid appUser ID in token." });

        // Hent ID-er til den innloggede brukerens venner
        var currentUserFriendIds = await context.Friendships
            .Where(f => f.UserId == currentUserId || f.FriendId == currentUserId)
            .Select(f => f.UserId == currentUserId ? f.FriendId : f.UserId)
            .ToListAsync();

        // Hent vennelisten til bruker med id `userId`
        var friends = await context.Friendships
            .Include(f => f.User).ThenInclude(u => u.UserProfile)
            .Include(f => f.FriendUser).ThenInclude(u => u.UserProfile)
            .AsNoTracking()
            .Where(f => (f.UserId == userId || f.FriendId == userId) &&
                        !(f.UserId == userId && f.FriendId == userId)) // Utelukker oss selv
            .Select(f => new FriendDTO
            {
                CurrentUserId = currentUserId,
                CreatedAt = f.CreatedAt,
                UserToFriendUserScore = f.UserId == userId ? f.UserToFriendUserScore : f.FriendUserToUserScore,
                FriendUserToUserScore = f.UserId == userId ? f.FriendUserToUserScore : f.UserToFriendUserScore,
                Friend = f.UserId == userId
                    ? new UserSummaryDto
                    {
                        Id = f.FriendUser.Id,
                        FullName = f.FriendUser.FullName,
                        ProfileImageUrl = f.User.ProfileImageUrl
                    }
                    : new UserSummaryDto
                    {
                        Id = f.User.Id,
                        FullName = f.User.FullName,
                        ProfileImageUrl = f.User.ProfileImageUrl
                    }
            })
            .ToListAsync();

        // Sorter slik at felles venner vises først
        var sorted = friends
            .OrderByDescending(f => currentUserFriendIds.Contains(f.Friend.Id))
            .ThenBy(f => f.Friend.FullName)
            .ToList();

        return Ok(sorted);
    }
    
    // Sjekk om vi er venn med en annen bruker
    [HttpGet("is-friend-with/{otherUserId}")]
    public async Task<IActionResult> IsFriendWith(int otherUserId)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid appUser ID in token." });
        }

        var isFriend = await context.Friendships.AnyAsync(f =>
            (f.UserId == userId && f.FriendId == otherUserId) ||
            (f.UserId == otherUserId && f.FriendId == userId));

        return Ok(new { isFriend });
    }

    // DELETE: Fjern venn
    [HttpDelete("{friendId}")]
    public async Task<IActionResult> RemoveFriend(int friendId)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid appUser ID in token." });
        }

        // Finn relasjonen i én retning
        var friendship = await context.Friendships
            .FirstOrDefaultAsync(f =>
                (f.UserId == userId && f.FriendId == friendId) ||
                (f.UserId == friendId && f.FriendId == userId));
        
        if (friendship == null)
            return NotFound("Friendship not found.");
        
        var removedUserId = friendship.UserId;
        var removedFriendId = friendship.FriendId;
        
        // SLETT ALLE RELATERTE FRIEND INVITATIONS (begge retninger)
        var existingInvitations = await context.FriendshipRequests
            .Where(inv => 
                (inv.SenderId == userId && inv.ReceiverId == friendId) ||
                (inv.SenderId == friendId && inv.ReceiverId == userId))
            .ToListAsync();

        if (existingInvitations.Any())
        {
            Log.Information("Removing {Count} friend invitations between users {UserId} and {FriendId}", 
                existingInvitations.Count, userId, friendId);
            context.FriendshipRequests.RemoveRange(existingInvitations);
        }


        context.Friendships.Remove(friendship);
        await context.SaveChangesAsync();
        
        // SYNC EVENT - etter SaveChanges
        taskQueue.QueueAsync(async () => 
        {
            using var scope = scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();

            try 
            {
                // Event til første bruker - fjern den andre som venn
                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.FRIEND_REMOVED,
                    eventData: new { 
                        friendId = removedFriendId,
                        removedBy = userId
                    },
                    singleUserId: removedUserId,
                    source: "API",
                    relatedEntityId: removedFriendId,
                    relatedEntityType: "Friends"
                );

                // Event til andre bruker - fjern den første som venn  
                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.FRIEND_REMOVED,
                    eventData: new { 
                        friendId = removedUserId,
                        removedBy = userId
                    },
                    singleUserId: removedFriendId,
                    source: "API",
                    relatedEntityId: removedUserId,
                    relatedEntityType: "Friends"
                );
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to create sync events for friend removal. UserId: {UserId}, FriendId: {FriendId}, RemovedBy: {RemovedBy}", 
                    removedUserId, removedFriendId, userId);
            }
        });

        return Ok(new { message = "Friend removed" });
    }
}
