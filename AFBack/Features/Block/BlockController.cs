using AFBack.Cache;
using AFBack.Constants;
using AFBack.Data;
using AFBack.Extensions;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Features.SyncEvents.Services;
using AFBack.Functions;
using AFBack.Hubs;
using AFBack.Infrastructure.Services;
using AFBack.Interface.Services;
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
public class BlockController(
    ApplicationDbContext context,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    ISendMessageCache sendMessageCache,
    ILogger<BlockController> logger,
    UserCache userCache,
    ResponseService responseService)
    : BaseController<BlockController>(context, logger, userCache, responseService)
{
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
         var userToBlock = await Context.Users.FindAsync(userId);
         if (userToBlock == null)
         {
             return NotFound("Bruker ikke funnet");
         }

         // Sjekk om blokkeringen allerede eksisterer
         var existingBlock = await Context.UserBlocks
             .FirstOrDefaultAsync(ub => ub.BlockerId == currentUserId && ub.BlockedUserId == userId);

         if (existingBlock != null)
         {
             return Conflict("Brukeren er allerede blokkert");
         }

         // ✅ Hent 1-til-1 samtale mellom brukerne
         var oneToOneConversation = await Context.Conversations
             .Where(c => c.IsGroup == false)
             .Where(c => Context.ConversationParticipants
                             .Where(cp => cp.ConversationId == c.Id)
                             .Select(cp => cp.UserId)
                             .Contains(currentUserId.Value) &&
                         Context.ConversationParticipants
                             .Where(cp => cp.ConversationId == c.Id)
                             .Select(cp => cp.UserId)
                             .Contains(userId))
             .FirstOrDefaultAsync();

         var userBlock = new UserBlock
         {
             BlockerId = currentUserId.Value,
             BlockedUserId = userId,
             BlockedAt = DateTime.UtcNow
         };

         Context.UserBlocks.Add(userBlock);

         // ✅ Fjern CanSend for begge brukere hvis 1-til-1 samtale eksisterer
         if (oneToOneConversation != null)
         {
             await Context.RemoveCanSendAsync(currentUserId.Value, oneToOneConversation.Id, sendMessageCache);
             await Context.RemoveCanSendAsync(userId, oneToOneConversation.Id, sendMessageCache);
        
             Console.WriteLine($"🚫 Removed CanSend for both users in conversation {oneToOneConversation.Id} due to blocking");
         }
         
         await Context.SaveChangesAsync();
         
         // 🆕 Send separate blocking events med komplett UserSummary
        taskQueue.QueueAsync(async () => 
        {
            using var scope = scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
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
                Console.WriteLine($"Failed to create sync/signalr events for appUser blocking. BlockerId: {currentUserId}, BlockedId: {userId}, Error: {ex.Message}");
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
        var existingBlock = await Context.UserBlocks
            .FirstOrDefaultAsync(ub => ub.BlockerId == currentUserId && ub.BlockedUserId == userId);

        if (existingBlock == null)
        {
            return NotFound("Blokkering ikke funnet");
        }
        
        // Sjekk forhold før unblocking for å vite om CanSend skal gjenopprettes
        var areFriends = await Context.Friends
            .AnyAsync(f => (f.UserId == currentUserId && f.FriendId == userId) ||
                           (f.UserId == userId && f.FriendId == currentUserId));

        // Sjekk om det finnes godkjent MessageRequest mellom brukerne
        var hasApprovedMessageRequest = await Context.MessageRequests
            .AnyAsync(mr => ((mr.SenderId == currentUserId && mr.ReceiverId == userId) ||
                             (mr.SenderId == userId && mr.ReceiverId == currentUserId)) &&
                            mr.IsAccepted == true && mr.IsRejected == false);

        // Hent 1-til-1 samtale mellom brukerne
        var oneToOneConversation = await Context.Conversations
            .Where(c => c.IsGroup == false)
            .Where(c => Context.ConversationParticipants
                            .Where(cp => cp.ConversationId == c.Id)
                            .Select(cp => cp.UserId)
                            .Contains(currentUserId.Value) &&
                        Context.ConversationParticipants
                            .Where(cp => cp.ConversationId == c.Id)
                            .Select(cp => cp.UserId)
                            .Contains(userId))
            .FirstOrDefaultAsync();

        Context.UserBlocks.Remove(existingBlock);

        // Gjenopprett CanSend hvis forholdene tillater det
        if (oneToOneConversation != null && (areFriends || hasApprovedMessageRequest))
        {
            var reason = areFriends ? CanSendReason.Friendship : CanSendReason.MessageRequest;
        
            await Context.AddCanSendAsync(currentUserId.Value, oneToOneConversation.Id, sendMessageCache, reason);
            await Context.AddCanSendAsync(userId, oneToOneConversation.Id, sendMessageCache, reason);
        
            Console.WriteLine($"Restored CanSend for both users in conversation {oneToOneConversation.Id} after unblocking. Reason: {reason}");
        }
        
        await Context.SaveChangesAsync();
        
        // Send samme struktur som BlockUser - komplette UserSummary objekter
        taskQueue.QueueAsync(async () => 
        {
            using var scope = scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
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
                Console.WriteLine($"Failed to create sync/signalr events for appUser unblocking. UnblockerId: {currentUserId}, UnblockedId: {userId}, Error: {ex.Message}");
            }
        });

        return Ok(new { message = "Brukeren har blitt avblokkert" });
    }          
        
}