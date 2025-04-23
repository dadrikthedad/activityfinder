using System.Security.Claims;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;
// Håndterer vennskap mellom to brukere
[ApiController]
[Route("api/friends")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FriendsController(ApplicationDbContext context)
    {
        _context = context;
    }
    

    // GET: Hent alle venner for innlogget bruker, brukes i Friends og skal senere brukes i profilsiden
    [HttpGet]
    public async Task<ActionResult<List<FriendDTO>>> GetFriends()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid user ID in token." });
        

        var friends = await _context.Friends
            .Include(f => f.User)
            .ThenInclude(u => u.Profile)
            .Include(f => f.FriendUser)
            .ThenInclude(u => u.Profile)
            .AsNoTracking()
            .Where(f => f.UserId == userId || f.FriendId == userId)
            .Select(f => new FriendDTO
            {
                CurrentUserId = userId,
                CreatedAt = f.CreatedAt,
                UserToFriendUserScore = f.UserId == userId ? f.UserToFriendUserScore : f.FriendUserToUserScore,
                FriendUserToUserScore = f.UserId == userId ? f.FriendUserToUserScore : f.UserToFriendUserScore,

                Friend = f.UserId == userId
                    ? new UserSummaryDTO
                    {
                        Id = f.FriendUser.Id,
                        FullName = f.FriendUser.FullName,
                        ProfileImageUrl = f.FriendUser.Profile != null ? f.FriendUser.Profile.ProfileImageUrl : null
                    }
                    : new UserSummaryDTO
                    {
                        Id = f.User.Id,
                        FullName = f.User.FullName,
                        ProfileImageUrl = f.User.Profile != null ? f.User.Profile.ProfileImageUrl : null
                    }
            })
            .ToListAsync();
        
        return Ok(friends);
    }
    
    // Henter venner til annen bruker
    [HttpGet("of/{userId}")]
    public async Task<ActionResult<List<FriendDTO>>> GetFriendsOfUser(int userId)
    {
        // Henter token til brukeren
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var currentUserId))
            return Unauthorized(new { message = "Invalid user ID in token." });

        // Hent ID-er til den innloggede brukerens venner
        var currentUserFriendIds = await _context.Friends
            .Where(f => f.UserId == currentUserId || f.FriendId == currentUserId)
            .Select(f => f.UserId == currentUserId ? f.FriendId : f.UserId)
            .ToListAsync();

        // Hent vennelisten til bruker med id `userId`
        var friends = await _context.Friends
            .Include(f => f.User).ThenInclude(u => u.Profile)
            .Include(f => f.FriendUser).ThenInclude(u => u.Profile)
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
                    ? new UserSummaryDTO
                    {
                        Id = f.FriendUser.Id,
                        FullName = f.FriendUser.FullName,
                        ProfileImageUrl = f.FriendUser.Profile != null ? f.FriendUser.Profile.ProfileImageUrl : null
                    }
                    : new UserSummaryDTO
                    {
                        Id = f.User.Id,
                        FullName = f.User.FullName,
                        ProfileImageUrl = f.User.Profile != null ? f.User.Profile.ProfileImageUrl : null
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
            return Unauthorized(new { message = "Invalid user ID in token." });
        }

        var isFriend = await _context.Friends.AnyAsync(f =>
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
            return Unauthorized(new { message = "Invalid user ID in token." });
        }

        // Finn relasjonen i én retning
        var friendship = await _context.Friends
            .FirstOrDefaultAsync(f =>
                (f.UserId == userId && f.FriendId == friendId) ||
                (f.UserId == friendId && f.FriendId == userId));
        
        if (friendship == null)
            return NotFound("Friendship not found.");

        _context.Friends.Remove(friendship);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Friend removed" });
    }
}
