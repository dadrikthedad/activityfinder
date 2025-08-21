using AFBack.Constants;
using AFBack.Data;
using AFBack.Extensions;
using AFBack.Functions;
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
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SendMessageCache _sendMessageCache;

    public BlockedController(
        ApplicationDbContext context,
        IBackgroundTaskQueue taskQueue, 
        IServiceScopeFactory scopeFactory,
        SendMessageCache sendMessageCache) 
    {
        _context = context;
        _taskQueue = taskQueue; 
        _scopeFactory = scopeFactory;
        _sendMessageCache = sendMessageCache;
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
         var existingBlock = await _context.UserBlocks
             .FirstOrDefaultAsync(ub => ub.BlockerId == currentUserId && ub.BlockedUserId == userId);

         if (existingBlock != null)
         {
             return Conflict("Brukeren er allerede blokkert");
         }

         // ✅ Hent 1-til-1 samtale mellom brukerne
         var oneToOneConversation = await _context.Conversations
             .Where(c => c.IsGroup == false)
             .Where(c => _context.ConversationParticipants
                             .Where(cp => cp.ConversationId == c.Id)
                             .Select(cp => cp.UserId)
                             .Contains(currentUserId.Value) &&
                         _context.ConversationParticipants
                             .Where(cp => cp.ConversationId == c.Id)
                             .Select(cp => cp.UserId)
                             .Contains(userId))
             .FirstOrDefaultAsync();

         var userBlock = new UserBlocks
         {
             BlockerId = currentUserId.Value,
             BlockedUserId = userId,
             BlockedAt = DateTime.UtcNow
         };

         _context.UserBlocks.Add(userBlock);

         // ✅ Fjern CanSend for begge brukere hvis 1-til-1 samtale eksisterer
         if (oneToOneConversation != null)
         {
             await _context.RemoveCanSendAsync(currentUserId.Value, oneToOneConversation.Id, _sendMessageCache);
             await _context.RemoveCanSendAsync(userId, oneToOneConversation.Id, _sendMessageCache);
        
             Console.WriteLine($"🚫 Removed CanSend for both users in conversation {oneToOneConversation.Id} due to blocking");
         }
         
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
        var existingBlock = await _context.UserBlocks
            .FirstOrDefaultAsync(ub => ub.BlockerId == currentUserId && ub.BlockedUserId == userId);

        if (existingBlock == null)
        {
            return NotFound("Blokkering ikke funnet");
        }
        
        // Sjekk forhold før unblocking for å vite om CanSend skal gjenopprettes
        var areFriends = await _context.Friends
            .AnyAsync(f => (f.UserId == currentUserId && f.FriendId == userId) ||
                           (f.UserId == userId && f.FriendId == currentUserId));

        // Sjekk om det finnes godkjent MessageRequest mellom brukerne
        var hasApprovedMessageRequest = await _context.MessageRequests
            .AnyAsync(mr => ((mr.SenderId == currentUserId && mr.ReceiverId == userId) ||
                             (mr.SenderId == userId && mr.ReceiverId == currentUserId)) &&
                            mr.IsAccepted == true && mr.IsRejected == false);

        // Hent 1-til-1 samtale mellom brukerne
        var oneToOneConversation = await _context.Conversations
            .Where(c => c.IsGroup == false)
            .Where(c => _context.ConversationParticipants
                            .Where(cp => cp.ConversationId == c.Id)
                            .Select(cp => cp.UserId)
                            .Contains(currentUserId.Value) &&
                        _context.ConversationParticipants
                            .Where(cp => cp.ConversationId == c.Id)
                            .Select(cp => cp.UserId)
                            .Contains(userId))
            .FirstOrDefaultAsync();

        _context.UserBlocks.Remove(existingBlock);

        // Gjenopprett CanSend hvis forholdene tillater det
        if (oneToOneConversation != null && (areFriends || hasApprovedMessageRequest))
        {
            var reason = areFriends ? CanSendReason.Friendship : CanSendReason.MessageRequest;
        
            await _context.AddCanSendAsync(currentUserId.Value, oneToOneConversation.Id, _sendMessageCache, reason);
            await _context.AddCanSendAsync(userId, oneToOneConversation.Id, _sendMessageCache, reason);
        
            Console.WriteLine($"Restored CanSend for both users in conversation {oneToOneConversation.Id} after unblocking. Reason: {reason}");
        }
        
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