using System.Security.Claims;
using AFBack.Constants;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.Services;
using AFBack.Interface.Services;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Data;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;


[Route("api/profile")]
[ApiController]
[Authorize]
public class ProfileController(
    ApplicationDbContext context,
    ILogger<ProfileController> logger,
    BlobServiceClient blobServiceClient,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<ProfileController>(context, logger, userCache, responseService)
{
    private readonly BlobServiceClient _blobServiceClient = blobServiceClient;

    // Henter en bruker sin profil, henter både fra AppUser.cs, UserProfile.cs og UserSettings.cs. Denne brukes både på profile/[id], editprofile og settings
    [AllowAnonymous]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPublicProfile(int id)
    {
        // Brukes for å sjekke om det er vår profil eller noen andres
        bool isOwner = false;
        
        // Sjekker om vi er brukeren med token
        if (User.Identity?.IsAuthenticated == true &&
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var currentUserId))
        { // Hvis vi er brukeren så blir owner true.
            isOwner = currentUserId == id;
        }
        
        // Henter profilen til brukeren
        var profile = await Context.Profiles
            .Include(p => p.AppUser)
            .FirstOrDefaultAsync(p => p.UserId == id);
        
        if (profile == null)
            return NotFound(new { message = "UserProfile not found" });
        
        // Henter innstillinger til brukeren
        var settings = await Context.UserSettings.FirstOrDefaultAsync(s => s.UserId == id);
        
        if (settings == null)
            return NotFound(new { message = "UserSettings not found" });
        
        var dto = new PublicProfileDTO
        {
            // Henter fra AppUser.cs og profile.cs
            UserId = profile.UserId,
            // Sjekker om det er bruker sin profil eller noen andres profil
            IsOwner = isOwner,
            FirstName = profile.AppUser.FirstName,
            MiddleName = profile.AppUser.MiddleName,
            LastName = profile.AppUser.LastName,
            FullName = profile.AppUser.FullName,
            ProfileImageUrl = profile.AppUser.ProfileImageUrl,
            Bio = profile.Bio,
            Websites = profile.Websites,
            Country = profile.AppUser.Country,
            Region = profile.AppUser.Region,
            PostalCode = profile.AppUser.PostalCode,
            DateOfBirth = profile.AppUser.DateOfBirth,
            Age = profile.AppUser.Age,
            Gender = profile.AppUser.Gender,
            ContactEmail = profile.ContactEmail,
            ContactPhone = profile.ContactPhone,
            // Stats
            TotalLikesGiven = profile.TotalLikesGiven,
            TotalLikesRecieved = profile.TotalLikesRecieved,
            TotalCommentsMade = profile.TotalCommentsMade,
            TotalMessagesRecieved = profile.TotalMessagesRecieved,
            TotalMessagesSendt = profile.TotalMessagesSendt,
            UpdatedAt = profile.UpdatedAt,
            
            //Innstillinger fra UserSettings.cs
            PublicProfile = settings.PublicProfile,
            ShowGender = settings.ShowGender,
            ShowEmail = settings.ShowEmail,
            ShowPhone = settings.ShowPhone,
            ShowRegion = settings.ShowRegion,
            ShowPostalCode = settings.ShowPostalCode,
            ShowStats = settings.ShowStats,
            ShowWebsites = settings.ShowWebsites,
            ShowAge = settings.ShowAge,
            ShowBirthday = settings.ShowBirthday,
            Language = settings.Language,
            RecieveEmailNotifications = settings.RecieveEmailNotifications,
            RecievePushNotifications = settings.RecievePushNotifications,
        };

        return Ok(dto);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] ProfileDTO dto)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid appUser ID in token." });
        }
        
        var profile = await Context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            return NotFound(new { message = "UserProfile not found." });
        }
        
        // Ta vare på gamle verdier for å kunne sammenligne
        var oldProfileImageUrl = profile.AppUser.ProfileImageUrl;
        var oldBio = profile.Bio;

        profile.AppUser.ProfileImageUrl = dto.ProfileImageUrl;
        profile.Bio = dto.Bio;
        profile.SetWebsites(dto.Websites ?? new List<string>());
        profile.UpdatedAt = DateTime.UtcNow;

        await Context.SaveChangesAsync();
        
        // SYNC EVENT - til alle venner
         taskQueue.QueueAsync(async () => 
        {
            using var scope = scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try 
            {
                // Hent alle venner som trenger oppdatering
                var friendIds = await context.Friends
                    .Where(f => f.UserId == userId || f.FriendId == userId)
                    .Select(f => f.UserId == userId ? f.FriendId : f.UserId)
                    .ToListAsync();

                if (friendIds.Any())
                {
                    // Finn ut hvilke felter som faktisk endret seg
                    var updatedFields = new List<string>();
                    if (oldProfileImageUrl != dto.ProfileImageUrl) updatedFields.Add("profileImage");
                    if (oldBio != dto.Bio) updatedFields.Add("bio");
                    // Websites endres alltid siden vi kaller SetWebsites, så vi inkluderer den
                    updatedFields.Add("websites");

                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.USER_PROFILE_UPDATED,
                        eventData: new { 
                            userId = userId,
                            updatedFields = updatedFields,
                            profileImageUrl = dto.ProfileImageUrl,
                            bio = dto.Bio,
                            websites = dto.Websites ?? new List<string>(),
                            updatedAt = DateTime.UtcNow
                        },
                        targetUserIds: friendIds,
                        source: "API",
                        relatedEntityId: userId,
                        relatedEntityType: "AppUser"
                    );
                }
            }
            catch (Exception ex)
            {
                // Log error - bruk din logger
                Console.WriteLine($"Failed to create sync event for profile update. UserId: {userId}, Error: {ex.Message}");
            }
        });

        return Ok(new { message = "UserProfile updated successfully" });
    }

    
    // Endring av Bio.
    [HttpPatch("bio")]
    public async Task<IActionResult> UpdateBio([FromBody] string newBio)
    {   
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid appUser ID in token." });
        }
        
        var profile = await Context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "UserProfile not found." });

        profile.Bio = newBio;
        profile.UpdatedAt = DateTime.UtcNow;

        await Context.SaveChangesAsync();
        return Ok(new { message = "Bio updated successfully." });
    }
    
    // Endringer av websites
    [HttpPatch("websites")]
    public async Task<IActionResult> UpdateWebsites([FromBody] UpdateWebsitesDTO dto)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid appUser ID in token." });
        }
        
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var profile = await Context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "UserProfile not found." });

        var cleaned = dto.Websites
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim())
            .ToList();

        profile.SetWebsites(cleaned);
        profile.UpdatedAt = DateTime.UtcNow;

        await Context.SaveChangesAsync();

        return Ok(new { message = "Websites updated successfully." });
    }
    
    // Endring av Bio.
    [HttpPatch("contact-email")]
    public async Task<IActionResult> UpdateContactEmail([FromBody] UpdateContactEmailDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid appUser ID in token." });

        var profile = await Context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "UserProfile not found." });

        profile.ContactEmail = string.IsNullOrWhiteSpace(dto.ContactEmail) ? null : dto.ContactEmail.Trim();
        profile.UpdatedAt = DateTime.UtcNow;

        await Context.SaveChangesAsync();
        return Ok(new { message = "Contact email updated." });
    }
    
    [HttpPatch("contact-phone")]
    public async Task<IActionResult> UpdateContactPhone([FromBody] UpdateContactPhoneDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid appUser ID in token." });

        var profile = await Context.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
            return NotFound(new { message = "UserProfile not found." });

        profile.ContactPhone = string.IsNullOrWhiteSpace(dto.ContactPhone) ? null : dto.ContactPhone.Trim();
        profile.UpdatedAt = DateTime.UtcNow;

        await Context.SaveChangesAsync();
        return Ok(new { message = "Contact phone updated." });
    }
}
