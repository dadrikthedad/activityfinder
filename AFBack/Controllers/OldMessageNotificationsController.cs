// using System.Security.Claims;
// using AFBack.Constants;
// using AFBack.Data;
// using AFBack.Features.Cache;
// using AFBack.Features.Cache.Interface;
// using AFBack.Features.MessageNotifications.Service;
// using AFBack.Features.SyncEvents.Services;
// using AFBack.Infrastructure.Services;
// using AFBack.Interface.Services;
// using AFBack.Models;
// using AFBack.Services;
// using Microsoft.AspNetCore.Authorization;
// using Microsoft.AspNetCore.Mvc;
// using Microsoft.EntityFrameworkCore;
//
// namespace AFBack.Controllers;
//
// [ApiController]
// [Route("api/[controller]")]
// [Authorize]
// public class MessageNotificationsController(
//     ApplicationDbContext context,
//     IMessageNotificationService notificationService,
//     GroupNotificationService groupNotificationService,
//     IBackgroundTaskQueue taskQueue,
//     IServiceScopeFactory scopeFactory,
//     ILogger<MessageNotificationsController> logger,
//     IUserCache userCache,
//     ResponseService responseService)
//     : BaseController<MessageNotificationsController>(context, logger, userCache, responseService)
// {
//     private readonly GroupNotificationService _groupNotificationService = groupNotificationService;
//
//
//     // Henter alle Notifications
//     [HttpGet]
//     public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
//     {
//         try
//         {
//             var userId = GetUserId();
//             if (userId == null)
//                 return Unauthorized();
//
//             if (page < 1 || pageSize <= 0)
//                 return BadRequest("Ugyldig pagineringsverdi.");
//
//             var (notifications, totalCount) = await notificationService.GetUserNotificationsAsync(
//                 userId.Value, page, pageSize);
//
//             return Ok(new
//             {
//                 page,
//                 pageSize,
//                 totalCount,
//                 totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
//                 notifications
//             });
//         }
//         catch (Exception ex)
//         {
//             return StatusCode(500, "En feil oppstod ved henting av notifikasjoner.");
//         }
//     }
//     
//     // Henter alle samtaler hvor vi har uleste notifikasjoner
//     [HttpGet("unread-conversations")]
//     public async Task<IActionResult> GetUnreadConversationIds()
//     {
//         var userId = GetUserId();
//
//         var unreadConvIds = await Context.MessageNotifications
//             .Where(n => n.UserId == userId && !n.IsRead && n.ConversationId != null)
//             .Select(n => n.ConversationId!.Value)
//             .Distinct()
//             .ToListAsync();
//
//         return Ok(unreadConvIds);
//     }
//     
//     // Henter antall uleste notifications
//     [HttpGet("unread-count")]
//     public async Task<IActionResult> GetUnreadNotificationCount()
//     {
//         var userId = GetUserId();
//
//         var count = await Context.MessageNotifications
//             .CountAsync(n => n.UserId == userId && !n.IsRead);
//
//         return Ok(new { count });
//     }
//     
//     // Leser en notificastion
//     [HttpPost("mark-as-read/{id}")]
//     public async Task<IActionResult> MarkAsRead(int id)
//     {
//         var userId = GetUserId();
//
//         var notification = await Context.MessageNotifications
//             .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
//
//         if (notification == null)
//             return NotFound();
//
//         if (!notification.IsRead)
//         {
//             notification.IsRead = true;
//             notification.ReadAt = DateTime.UtcNow;
//             await Context.SaveChangesAsync();
//         }
//
//         return NoContent();
//     }
//     
//     // Setter alle notifikasjoner til en samtale lest
//     [HttpPost("mark-conversation-as-read/{conversationId}")]
//     public async Task<IActionResult> MarkConversationAsRead(int conversationId)
//     {
//         var userId = GetUserId();
//
//         var unreadNotifications = await Context.MessageNotifications
//             .Where(n => n.UserId == userId && !n.IsRead && n.ConversationId == conversationId)
//             .ToListAsync();
//
//         if (!unreadNotifications.Any())
//         {
//             return NoContent(); // Ingen uleste notifikasjoner å markere
//         }
//         
//         var readAt = DateTime.UtcNow;
//
//         foreach (var n in unreadNotifications)
//         {
//             n.IsRead = true;
//             n.ReadAt = readAt;
//         }
//
//         await Context.SaveChangesAsync();
//
//         // Send sync event for å oppdatere frontend
//         taskQueue.QueueAsync(async () => 
//         {
//             using var scope = scopeFactory.CreateScope();
//             var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
//
//             try 
//             {
//                 await syncService.CreateAndDistributeSyncEventAsync(
//                     eventType: SyncEventTypes.MARK_AS_READ,
//                     eventData: new { 
//                         ConversationId = conversationId,
//                     },
//                     singleUserId: userId,
//                     source: "API",
//                     relatedEntityId: conversationId,
//                     relatedEntityType: "Conversations"
//                 );
//             }
//             catch (Exception ex)
//             {
//                 Logger.LogError(ex, "Failed to create MARK_AS_READ sync event for conversation {ConversationId}", conversationId);
//             }
//         });
//
//         return NoContent();
//     }
//     
//     // Setter ALLe notifikasjoner som lest
//     [HttpPost("mark-all-as-read")]
//     public async Task<IActionResult> MarkAllAsRead()
//     {
//         var userId = GetUserId();
//
//         var unreadNotifications = await Context.MessageNotifications
//             .Where(n => n.UserId == userId && !n.IsRead)
//             .ToListAsync();
//
//         if (!unreadNotifications.Any())
//         {
//             return NoContent(); // Ingen uleste notifikasjoner å markere
//         }
//         
//         var readAt = DateTime.UtcNow;
//         foreach (var n in unreadNotifications)
//         {
//             n.IsRead = true;
//             n.ReadAt = readAt; 
//         }
//
//         await Context.SaveChangesAsync();
//
//         // Send sync event for å oppdatere frontend
//         taskQueue.QueueAsync(async () => 
//         {
//             using var scope = scopeFactory.CreateScope();
//             var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
//
//             try 
//             {
//                 await syncService.CreateAndDistributeSyncEventAsync(
//                     eventType: SyncEventTypes.MARK_ALL_AS_READ,
//                     eventData: new { Type = "all" },
//                     singleUserId: userId,
//                     source: "API",
//                     relatedEntityId: null, // Siden dette gjelder alle notifikasjoner
//                     relatedEntityType: "MessageNotification"
//                 );
//             }
//             catch (Exception ex)
//             {
//                 Logger.LogError(ex, "Failed to create MARK_AS_READ sync event for all notifications");
//             }
//         });
//
//         return NoContent();
//     }
//     
// }
