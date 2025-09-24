using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using AFBack.Data;
using AFBack.Models;

namespace AFBack.Controllers
{
    [ApiController]
    public abstract class BaseController : ControllerBase
    {
        protected readonly ApplicationDbContext _context;

        protected BaseController(ApplicationDbContext context)
        {
            _context = context;
        }
        
        protected int? GetUserId()
        {
            var claimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claimValue, out var id) ? id : null;
        }

        protected async Task<User?> GetUserFromClaims()
        {
            var userId = GetUserId();
            if (userId == null)
                return null;

            return await _context.Users.FindAsync(userId.Value);
        }
    }
}