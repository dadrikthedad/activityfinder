using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;
// Håndterer vennskap mellom to brukere
[ApiController]
[Route("api/friends")]
public class FriendsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FriendsController(ApplicationDbContext context)
    {
        _context = context;
    }
    

    // GET: Hent alle venner for en bruker
    [HttpGet("{userId}")]
    public async Task<ActionResult<List<FriendDTO>>> GetFriends(int userId)
    {
        var friends = await _context.Friends
            .Where(f => f.User.Id == userId)
            .Select(f => new FriendDTO
            {
                UserId = f.User.Id,
                FriendId = f.FriendUser.Id,
                CreatedAt = f.CreatedAt,
                UserToFriendUserScore = f.UserToFriendUserScore,
                FriendUserToUserScore = f.FriendUserToUserScore
            })
            .ToListAsync();

        return Ok(friends);
    }

    // DELETE: Fjern venn
    [HttpDelete("{userId}/{friendId}")]
    public async Task<IActionResult> RemoveFriend(int userId, int friendId)
    {
        var friendship = await _context.Friends.FindAsync(userId, friendId);
        if (friendship == null)
            return NotFound("Friendship not found.");

        _context.Friends.Remove(friendship);
        await _context.SaveChangesAsync();

        return Ok("Friend removed");
    }
}
