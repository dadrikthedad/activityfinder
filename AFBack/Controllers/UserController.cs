using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using AFBack.Constants;
using AFBack.DTOs.Auth;
using AFBack.Extensions;
using AFBack.Features.Auth.Models;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.Geography.Services;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Security.Utils;
using AFBack.Infrastructure.Services;
using AFBack.Services.User;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using AFBack.DTOs;
using AFBack.Models;
using BCrypt.Net;
using System.Threading.Tasks;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using AFBack.Services;
using CountryData.Standard;


// Forteller backend at alle API-endepunktene i denne klassen skal ha api/appUser som base-url
[Route("api/appUser")]
// Gjør klassen til en API-kontroller, automatisk sjekk at det er riktig input, automatisk konvertering JSON-requests til objekter.
[ApiController]
public class UserController(
    AppDbContext context,
    ILogger<UserController> logger,
    OldAuthService oldAuthService,
    CountryService countryService,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    EmailService emailService,
    UserService userService,
    EmailRateLimitService emailRateLimitService,
    IIpBanService ipBanService,
    GeolocationService geolocationService,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<UserController>(context, logger, userCache, responseService)
{
    
    // Henter informasjonen fra UserDTO for å vise epost på securitycred siden. Kan brukes senere til å vise info lett og greit, kanskje senere på andre sider
    // GUL Advarsel - Alt annet enn UserId, Email og Passord brukes ikke her eller i USerDTO
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        {
            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            {
                return Unauthorized(new { message = "Invalid appUser ID in token." });
            }
        
            var user = await Context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "AppUser not found." });

            var dto = new UserDTO
            {
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                DateOfBirth = user.DateOfBirth,
                Phone = user.Phone,
                Country = user.Country,
                Region = user.Region,
                PostalCode = user.PostalCode,
                Gender = user.Gender
            };

            return Ok(dto);
        }
    }
   
    
    // Henter informasjonen fra databasen til å vise på profil-siden
    [HttpGet("profilesettings")]
    [Authorize]
    public async Task<IActionResult> GetUserSettings()
    {
            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            {
                return Unauthorized(new { message = "Invalid appUser ID in token." });
            }
        
            var user = await Context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "AppUser not found." });

            var dto = new UserProfileSettingDTO
            {
                FirstName = user.FirstName,
                MiddleName = user.MiddleName,
                LastName = user.LastName,
                Phone = user.Phone,
                Country = user.Country,
                Region = user.Region,
                PostalCode = user.PostalCode,
                Gender = user.Gender
            };

            return Ok(dto);
    }
    
    
    
    // Patch for profilesettings sin endring av telefon
    [HttpPatch("phone")]
    [Authorize]
    public async Task<IActionResult> UpdatePhone([FromBody] UpdatePhoneDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        await Context.SaveChangesAsync();

        return Ok(new { message = "Phone updated." });
    }
    // Patch for profilesettings sin endring av land og region
    [HttpPatch("location")]
    [Authorize]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        // Valider land
        var countryName = countryService.GetCountryNameFromCode(dto.Country);
        if (countryName == null)
        {
            return BadRequest(new { message = "Invalid country code." });
        }

        user.Country = countryName;
        user.Region = dto.Region;

        await Context.SaveChangesAsync();

        return Ok(new { message = "Location updated." });
    }
    // Patch for profilesettings sin endring av postkode
    [HttpPatch("postalcode")]
    [Authorize]
    public async Task<IActionResult> UpdatePostalCode([FromBody] UpdatePostalCodeDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.PostalCode = dto.PostalCode;
        await Context.SaveChangesAsync();

        return Ok(new { message = "Postal code updated." });
    }
    // Patch for profilesettings sin endring av kjønn
    [HttpPatch("gender")]
    [Authorize]
    public async Task<IActionResult> UpdateGender([FromBody] UpdateGenderDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);
        
        var user = await GetUserFromClaims();
        if (user == null) return Unauthorized();

        user.Gender = dto.Gender;
        await Context.SaveChangesAsync();

        return Ok(new { message = "Gender updated." });
    }
    

    
    // Søke etter en bruker, brukes i søkebaren til navbar. Senere eventuelt lage en egen SearchController.cs feks
    [HttpGet("search")]
    public async Task<ActionResult<List<UserSummaryDto>>> SearchUsers([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty.");
        }

        var currentUserId = GetUserId(); // ✅ Kan være null hvis ikke innlogget

        // Normaliser søkestrengen
        var normalizedQuery = string.Join(" ", query
            .ToLower()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

        List<int> blockedUserIds = new List<int>();

        // ✅ Kun hent blocked relationships hvis innlogget
        if (currentUserId.HasValue)
        {
            blockedUserIds = await Context.UserBlocks
                .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
                .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
                .ToListAsync();
        }

        var results = await Context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                (currentUserId == null || u.Id != currentUserId) && // ✅ Ekskluder seg selv bare hvis innlogget
                !blockedUserIds.Contains(u.Id)) // ✅ Tom liste hvis ikke innlogget
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .Take(20)
            .ToListAsync();

        return Ok(results);
    }
    
    [HttpGet("search/group-invite/{conversationId}")]
    public async Task<ActionResult<List<UserSummaryDto>>> SearchUsersForGroupInvite(
    [FromRoute] int conversationId,
    [FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest("Query cannot be empty.");
        }

        var currentUserId = GetUserId();
        
        if (currentUserId == null)
        {
            return Unauthorized();
        }

        var normalizedQuery = string.Join(" ", query
            .ToLower()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

        // ✅ Hent blocked relationships
        var blockedUserIds = await Context.UserBlocks
            .Where(b => b.BlockerId == currentUserId || b.BlockedUserId == currentUserId)
            .Select(b => b.BlockerId == currentUserId ? b.BlockedUserId : b.BlockerId)
            .ToListAsync();

        var results = await Context.Users
            .Where(u => 
                u.FullName.ToLower().Contains(normalizedQuery) &&
                u.Id != currentUserId &&
                !blockedUserIds.Contains(u.Id) && // ✅ Ikke blocked users
                // Ikke eksisterende deltaker
                !Context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == u.Id) &&
                // Ikke rejected eller pending gruppeforespørsel
                !Context.GroupRequests
                    .Any(gr => gr.ConversationId == conversationId && 
                               gr.ReceiverId == u.Id &&
                               (gr.Status == GroupRequestStatus.Rejected || 
                                gr.Status == GroupRequestStatus.Pending)) &&
                // Sjekk at current appUser har tilgang (sikkerhet)
                Context.ConversationParticipants
                    .Any(cp => cp.ConversationId == conversationId && cp.UserId == currentUserId))
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl
            })
            .Take(20)
            .ToListAsync();

        return Ok(results);
    }
    
    
}
