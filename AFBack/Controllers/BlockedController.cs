using AFBack.Constants;
using AFBack.Data;
using AFBack.Extensions;
using AFBack.Hubs;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BlockedController : BaseController
{
    private readonly ApplicationDbContext _context;
    private readonly IBackgroundTaskQueue _taskQueue; // 🆕
    private readonly IServiceScopeFactory _scopeFactory; // 🆕

    public BlockedController(
        ApplicationDbContext context,
        IBackgroundTaskQueue taskQueue, // 🆕
        IServiceScopeFactory scopeFactory) // 🆕
    {
        _context = context;
        _taskQueue = taskQueue; // 🆕
        _scopeFactory = scopeFactory; // 🆕
    }
    
     // POST: api/userblocks/block/{userId}
     [HttpPost("block/{userId}")]
     public async Task<IActionResult> BlockUser(int userId)
     {
         // Hent den innloggede brukerens ID (dette avhenger av din autentiseringsoppsett)
         var currentUserId = GetUserId();
            
         if (currentUserId == null)
         {
             return Unauthorized("Bruker ikke autentisert");
         }

         // Sjekk at brukeren ikke prøver å blokkere seg selv
         if (currentUserId == userId)
         {
             return BadRequest("Du kan ikke blokkere deg selv");
         }

         // Sjekk at brukeren som skal blokkeres eksisterer
         var userToBlock = await _context.Users.FindAsync(userId);
         if (userToBlock == null)
         {
             return NotFound("Bruker ikke funnet");
         }

         // Sjekk om blokkeringen allerede eksisterer
         var existingBlock = await _context.UserBlock
             .FirstOrDefaultAsync(ub => ub.BlockerId == currentUserId && ub.BlockedUserId == userId);

         if (existingBlock != null)
         {
             return Conflict("Brukeren er allerede blokkert");
         }

         // Opprett ny blokkering
         var userBlock = new UserBlocks
         {
             BlockerId = currentUserId.Value,
             BlockedUserId = userId,
             BlockedAt = DateTime.UtcNow
         };

         _context.UserBlock.Add(userBlock);
         await _context.SaveChangesAsync();
         
         // 🆕 Send separate blocking events med komplett UserSummary
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<UserHub>>();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try 
            {
                // Hent UserSummary for begge brukere fra hverandres perspektiv
                var blockerSummaryForBlocked = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                    context, currentUserId.Value, userId); // Blokkeren sett fra den blokkertes perspektiv
                    
                var blockedSummaryForBlocker = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                    context, userId, currentUserId.Value); // Den blokkerte sett fra blokkerens perspektiv

                if (blockerSummaryForBlocked != null && blockedSummaryForBlocker != null)
                {

                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.USER_BLOCKED_UPDATED,
                        eventData: blockerSummaryForBlocked,
                        singleUserId: userId,
                        source: "API",
                        relatedEntityId: currentUserId.Value,
                        relatedEntityType: "UserBlock"
                    );
                    
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.USER_BLOCKED_UPDATED,
                        eventData: blockedSummaryForBlocker,
                        singleUserId: currentUserId.Value,
                        source: "API",
                        relatedEntityId: userId,
                        relatedEntityType: "UserBlock"
                    );

                    // 🆕 SignalR events
                    await hubContext.Clients.User(userId.ToString())
                        .SendAsync("UserBlockedUpdated", blockerSummaryForBlocked);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to create sync/signalr events for user blocking. BlockerId: {currentUserId}, BlockedId: {userId}, Error: {ex.Message}");
            }
        });
        
        return Ok(new { message = "Brukeren har blitt blokkert" });
     }

    // DELETE: api/userblocks/unblock/{userId}
    [HttpDelete("unblock/{userId}")]
    public async Task<IActionResult> UnblockUser(int userId)
    {
        var currentUserId = GetUserId();
            
        if (currentUserId == null)
        {
            return Unauthorized("Bruker ikke autentisert");
        }

        // Finn eksisterende blokkering
        var existingBlock = await _context.UserBlock
            .FirstOrDefaultAsync(ub => ub.BlockerId == currentUserId && ub.BlockedUserId == userId);

        if (existingBlock == null)
        {
            return NotFound("Blokkering ikke funnet");
        }

        _context.UserBlock.Remove(existingBlock);
        await _context.SaveChangesAsync();
        
        // Send samme struktur som BlockUser - komplette UserSummary objekter
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<UserHub>>();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try 
            {
                // Hent UserSummary for begge brukere fra hverandres perspektiv
                var blockerSummaryForUnblocked = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                    context, currentUserId.Value, userId); // Unblokkeren sett fra den unblokkertes perspektiv
                    
                var unblockedSummaryForBlocker = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                    context, userId, currentUserId.Value); // Den unblokerte sett fra unblockerens perspektiv

                if (blockerSummaryForUnblocked != null && unblockedSummaryForBlocker != null)
                {
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.USER_BLOCKED_UPDATED, // Samme event type
                        eventData: blockerSummaryForUnblocked,
                        singleUserId: userId,
                        source: "API",
                        relatedEntityId: currentUserId.Value,
                        relatedEntityType: "UserBlock"
                    );
                    
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.USER_BLOCKED_UPDATED, // Samme event type
                        eventData: unblockedSummaryForBlocker,
                        singleUserId: currentUserId.Value,
                        source: "API",
                        relatedEntityId: userId,
                        relatedEntityType: "UserBlock"
                    );

                    // SignalR til den som ble unblokkert
                    await hubContext.Clients.User(userId.ToString())
                        .SendAsync("UserBlockedUpdated", blockerSummaryForUnblocked);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to create sync/signalr events for user unblocking. UnblockerId: {currentUserId}, UnblockedId: {userId}, Error: {ex.Message}");
            }
        });

        return Ok(new { message = "Brukeren har blitt avblokkert" });
    }          
        
}