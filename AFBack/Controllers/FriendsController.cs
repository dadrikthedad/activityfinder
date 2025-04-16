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
    

    // GET: Hent alle venner for innlogget bruker
    [HttpGet]
    public async Task<ActionResult<List<FriendDTO>>> GetFriends()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid user ID in token." });
        

        var friends = await _context.Friends
            .Where(f => f.UserId == userId || f.FriendId == userId)
            .Select(f => new FriendDTO
            {
                CurrentUserId = userId,
                FriendId = f.UserId == userId ? f.FriendId : f.UserId,
                CreatedAt = f.CreatedAt,
                UserToFriendUserScore = f.UserId == userId ? f.UserToFriendUserScore : f.FriendUserToUserScore,
                FriendUserToUserScore = f.UserId == userId ? f.FriendUserToUserScore : f.UserToFriendUserScore
            })
            .ToListAsync();
        
        return Ok(friends);
    }
    
    // Henter venner til annen bruker
    [HttpGet("of/{userId}")]
    public async Task<ActionResult<List<FriendDTO>>> GetFriendsOfUser(int otherUserId)
    {
        
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid user ID in token." });
        
        var friends = await _context.Friends
            .Where(f => f.UserId == otherUserId || f.FriendId == otherUserId)
            .Select(f => new FriendDTO
            {
                CurrentUserId = userId,
                FriendId = f.UserId == otherUserId ? f.FriendId : f.UserId,
                CreatedAt = f.CreatedAt,
                UserToFriendUserScore = f.UserId == otherUserId ? f.UserToFriendUserScore : f.FriendUserToUserScore,
                FriendUserToUserScore = f.UserId == otherUserId ? f.FriendUserToUserScore : f.UserToFriendUserScore
            })
            .ToListAsync();

        return Ok(friends);
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

        return Ok("Friend removed");
    }
}
