using System.Text.Json;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Features.MessageNotification.Models;
using AFBack.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Services;

public class GroupNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<UserHub> _hubContext;
    private readonly NotificationSyncService _notificationSyncService;

    public GroupNotificationService(ApplicationDbContext context, IHubContext<UserHub> hubContext, NotificationSyncService notificationSyncService)
    {
        _context = context;
        _hubContext = hubContext;
        _notificationSyncService = notificationSyncService;
    }
    
    /// <summary>
    /// Sender oppdaterte GroupNotifications til alle godkjente medlemmer i en samtale
    /// </summary>
    /// <param name="conversationId">ID for samtalen som skal oppdateres</param>
    /// <param name="excludeUserIds">Brukere som skal ekskluderes fra oppdateringen (valgfritt)</param>
   public async Task SendGroupNotificationUpdatesAsync(int conversationId, List<int>? excludeUserIds = null,GroupEventType? eventType = null, List<int>? affectedUserIds = null )
    {
        try
        {
            // Hent alle godkjente medlemmer
            var approvedMemberIds = await GetApprovedMembersAsync(conversationId);
            
            // Ekskluder spesifiserte brukere hvis angitt
            if (excludeUserIds?.Any() == true)
            {
                approvedMemberIds = approvedMemberIds.Where(id => !excludeUserIds.Contains(id)).ToList();
            }
            
            var affectedUsers = new List<UserSummaryDto>();
            if (affectedUserIds?.Any() == true)
            {
                affectedUsers = await _context.AppUsers
                    .Where(u => affectedUserIds.Contains(u.Id))
                    .Select(u => new UserSummaryDto
                    {
                        Id = u.Id,
                        FullName = u.FullName,
                        ProfileImageUrl = u.ProfileImageUrl,
                        // 🆕 Legg til GroupRequestStatus basert på samtalen
                        GroupRequestStatus = _context.GroupRequests
                            .Where(gr => gr.ConversationId == conversationId && gr.ReceiverId == u.Id)
                            .Select(gr => gr.Status)
                            .FirstOrDefault()
                    })
                    .ToListAsync();
            }

            foreach (var memberId in approvedMemberIds)
            {
                try
                {
                    // 🆕 Hent MessageNotification direkte (GroupEvent type) med GroupEvents inkludert
                    var notification = await _context.MessageNotifications
                        .Include(n => n.Conversation)
                        .Include(n => n.GroupEvents) // Inkluder GroupEvents relasjonen
                        .FirstOrDefaultAsync(n => n.RecipientId == memberId && 
                                                 n.ConversationId == conversationId && 
                                                 n.Type == NotificationType.GroupEvent && 
                                                 !n.IsRead);

                    if (notification != null)
                    {
                        // Konverter til DTO med event summaries
                        var messageNotificationDTO = await ConvertToMessageNotificationDTOAsync(notification);
                        
                        if (messageNotificationDTO != null)
                        {
                            await _hubContext.Clients.User(memberId.ToString())
                                .SendAsync("GroupNotificationUpdated", new GroupNotificationUpdateDTO
                                {
                                    UserId = memberId,
                                    Notification = messageNotificationDTO,
                                    IsNewNotification = notification.EventCount == 1,
                                    GroupEventType = eventType ?? GroupEventType.MemberInvited,
                                    AffectedUsers = affectedUsers 
                                });
                            
                            // 🆕 Send sync event rett etter (for offline brukere)
                            _notificationSyncService.QueueNotificationSyncEvent(messageNotificationDTO, memberId);

                            Console.WriteLine($"✅ Sent GroupNotificationUpdated to member {memberId} for conversation {conversationId}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Failed to send group notification update to appUser {memberId}: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Failed to send group notification updates for conversation {conversationId}: {ex.Message}");
        }
    }
    


    public async Task CreateGroupEventAsync(GroupEventType eventType, int conversationId, int actorUserId, List<int> affectedUserIds, string? metadata = null)
    {
        // 1️⃣ Opprett GroupEvent
        var groupEvent = new GroupEvent
        {
            ConversationId = conversationId,
            EventType = eventType,
            ActorUserId = actorUserId,
            Metadata = metadata,
            CreatedAt = DateTime.UtcNow
        };

        _context.GroupEvents.Add(groupEvent);
        await _context.SaveChangesAsync();
        
        foreach (var userId in affectedUserIds)
        {
            _context.GroupEventAffectedUsers.Add(new GroupEventAffectedUser
            {
                GroupEventId = groupEvent.Id,
                UserId = userId
            });
        }
        await _context.SaveChangesAsync();

        // 2️⃣ Oppdater GroupNotifications for relevante brukere
        await UpdateGroupNotificationsAsync(conversationId, groupEvent.Id, new List<int> { actorUserId });
        
        // 3️⃣ Send automatisk GroupNotificationUpdates til alle godkjente medlemmer
        await SendGroupNotificationUpdatesAsync(conversationId, new List<int> { actorUserId }, eventType, affectedUserIds);
    }

    private async Task UpdateGroupNotificationsAsync(int conversationId, int newEventId, List<int>? excludeUserIds = null)
    {
        // Finn alle godkjente medlemmer i gruppen (ikke pending)
        var approvedMemberIds = await GetApprovedMembersAsync(conversationId);
        
        if (excludeUserIds?.Any() == true)
        {
            approvedMemberIds = approvedMemberIds.Where(id => !excludeUserIds.Contains(id)).ToList();
        }

        foreach (var memberId in approvedMemberIds)
        {
            // 🆕 Finn eller opprett MessageNotification (GroupEvent type)
            var notification = await _context.MessageNotifications
                .FirstOrDefaultAsync(n => n.RecipientId == memberId && 
                                          n.ConversationId == conversationId && 
                                          n.Type == NotificationType.GroupEvent && 
                                          !n.IsRead);
            
            if (notification == null)
            {
                // Opprett ny MessageNotification
                notification = new MessageNotification
                {
                    RecipientId = memberId,
                    ConversationId = conversationId,
                    Type = NotificationType.GroupEvent,
                    EventCount = 1,
                    LastUpdatedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false,
                };
                _context.MessageNotifications.Add(notification);
                await _context.SaveChangesAsync();
                
                _context.MessageNotificationGroupEvents.Add(new MessageNotificationGroupEvent
                {
                    MessageNotificationId = notification.Id,
                    GroupEventId = newEventId
                });
            }
            else
            {
                // Oppdater eksisterende notification
                _context.MessageNotificationGroupEvents.Add(new MessageNotificationGroupEvent
                {
                    MessageNotificationId = notification.Id,
                    GroupEventId = newEventId
                });
                
                notification.EventCount = (notification.EventCount ?? 0) + 1;
            }
        }
        
        await _context.SaveChangesAsync();
    }
    
    public async Task<MessageNotificationDTO> ConvertToMessageNotificationDTOAsync(MessageNotification notification)
    {
        // Hent GroupEvent IDs fra relasjonstabellen
        var groupEventIds = notification.GroupEvents.Select(nge => nge.GroupEventId).ToList();

        // Finn den siste hendelsen for å få ActorUser info
        var lastEvent = await _context.GroupEvents
            .Include(ge => ge.ActorUser)
            .ThenInclude(u => u.UserProfile)
            .Include(ge => ge.AffectedUsers) // Inkluder affected users
                .ThenInclude(au => au.User)
            .Where(ge => groupEventIds.Contains(ge.Id))
            .OrderByDescending(ge => ge.CreatedAt)
            .FirstOrDefaultAsync();

        // Bygg event summaries
        var events = await _context.GroupEvents
            .Include(ge => ge.ActorUser)
            .Include(ge => ge.AffectedUsers)
                .ThenInclude(au => au.AppUser)
            .Where(ge => groupEventIds.Contains(ge.Id))
            .OrderBy(ge => ge.CreatedAt)
            .ToListAsync();

        var eventSummaries = await BuildEventSummariesAsync(events);
        
        // 🆕 Hent affected users for den siste hendelsen
        List<UserSummaryDto> latestAffectedUsers = new();
    
        if (lastEvent?.AffectedUsers?.Any() == true)
        {
            var affectedUserIds = lastEvent.AffectedUsers.Select(au => au.UserId).ToList();
            
            latestAffectedUsers = await _context.AppUsers
                .Where(u => affectedUserIds.Contains(u.Id))
                .Select(u => new UserSummaryDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    ProfileImageUrl = u.ProfileImageUrl,
                    GroupRequestStatus = _context.GroupRequests
                        .Where(gr => gr.ConversationId == notification.ConversationId && gr.ReceiverId == u.Id)
                        .Select(gr => gr.Status)
                        .FirstOrDefault()
                })
                .ToListAsync();
        }

        // Sjekk rejected status
        var isRejected = await _context.GroupRequests
            .AnyAsync(gr => gr.ConversationId == notification.ConversationId && 
                           gr.ReceiverId == notification.RecipientId && 
                           gr.Status == GroupRequestStatus.Rejected);

        var groupName = notification.Conversation?.GroupName ?? "Unknown Group";
        
        return new MessageNotificationDTO
        {
            Id = notification.Id,
            Type = NotificationType.GroupEvent,
            CreatedAt = notification.CreatedAt,
            IsRead = notification.IsRead,
            ReadAt = notification.ReadAt,
            MessageId = null,
            ConversationId = notification.ConversationId,
            SenderName = lastEvent?.ActorUser?.FullName,
            SenderId = lastEvent?.ActorUserId,
            SenderProfileImageUrl = lastEvent?.ActorUser?.ProfileImageUrl,
            GroupName = groupName,
            GroupImageUrl = notification.Conversation?.GroupImageUrl,
            MessagePreview = (notification.EventCount ?? 0) > 1 
                ? $"There are {notification.EventCount} new activities in \"{groupName}\""
                : $"New activity in \"{groupName}\"",
            ReactionEmoji = null,
            MessageCount = notification.EventCount,
            IsConversationRejected = isRejected,
            IsReactionUpdate = false,
            EventSummaries = eventSummaries,
            LatestGroupEventType = lastEvent?.EventType.ToString(),
            LatestAffectedUsers = latestAffectedUsers
        };
    }

    private async Task<List<int>> GetApprovedMembersAsync(int conversationId)
    {
        // Hent alle participants
        var allParticipantIds = await _context.ConversationParticipants
            .Where(cp => cp.ConversationId == conversationId)
            .Select(cp => cp.UserId)
            .ToListAsync();

        // Hent alle som har pending GroupRequests
        var pendingUserIds = await _context.GroupRequests
            .Where(gr => gr.ConversationId == conversationId && gr.Status == GroupRequestStatus.Pending)
            .Select(gr => gr.ReceiverId)
            .ToListAsync();

        // Godkjente medlemmer = participants som IKKE har pending requests
        return allParticipantIds.Where(userId => !pendingUserIds.Contains(userId)).ToList();
    }

    private async Task<List<string>> BuildEventSummariesAsync(List<GroupEvent> events)
    {
        var summaries = new List<string>();
        // Sorter hendelser etter tidspunkt
        var sortedEvents = events.OrderBy(e => e.CreatedAt).ToList();
        for (int i = 0; i < sortedEvents.Count; i++)
        {
            var currentEvent = sortedEvents[i];
            var actorName = currentEvent.ActorUser?.FullName ?? "En bruker";
            // ✅ Bruk allerede inkluderte AffectedUsers
            var currentAffectedUserNames = currentEvent.AffectedUsers
                .Select(au => au.AppUser.FullName)
                .ToList();
            // 🔄 Konsekutiv gruppering
            var allAffectedUsers = new List<string>(currentAffectedUserNames);
            int eventsToSkip = 0;
            if (currentEvent.EventType == GroupEventType.MemberInvited || 
                currentEvent.EventType == GroupEventType.MemberRemoved)
            {
                for (int j = i + 1; j < sortedEvents.Count; j++)
                {
                    var nextEvent = sortedEvents[j];
                    if (nextEvent.EventType == currentEvent.EventType && 
                        nextEvent.ActorUserId == currentEvent.ActorUserId)
                    {
                        // ✅ Også her: Bruk inkluderte data
                        var nextAffectedUserNames = nextEvent.AffectedUsers
                            .Select(au => au.AppUser.FullName)
                            .ToList();
                        allAffectedUsers.AddRange(nextAffectedUserNames);
                        eventsToSkip++;
                    }
                    else
                    {
                        break;
                    }
                }
            }
            // 📝 Generer tekst
            string summary = currentEvent.EventType switch
            {
                GroupEventType.MemberInvited => 
                    $"{actorName} has invited: {string.Join(", ", allAffectedUsers.Distinct())}",
                GroupEventType.MemberAccepted => 
                    BuildAcceptedSummary(currentAffectedUserNames),
                GroupEventType.MemberLeft => 
                    $"{actorName} has left the group",
                GroupEventType.MemberRemoved => 
                    $"{actorName} removed: {string.Join(", ", allAffectedUsers.Distinct())}",
                GroupEventType.GroupNameChanged => 
                    BuildGroupNameChangedSummary(actorName, currentEvent.Metadata),
                GroupEventType.GroupImageChanged => 
                    $"{actorName} changed the group image",
                GroupEventType.GroupCreated => 
                    $"{actorName} created the group",
                _ => $"{actorName} performed an action"
            };
            summaries.Add(summary);
            // ⏭️ Hopp over grupperte events
            i += eventsToSkip;
        }
        return summaries;
    }

    private string BuildAcceptedSummary(List<string> userNames)
    {
        if (userNames.Count == 1)
            return $"{userNames[0]} has accepted the invite";
        
        if (userNames.Count == 2)
            return $"{userNames[0]} and {userNames[1]} have accepted the invite";
        
        if (userNames.Count > 2)
        {
            var lastUser = userNames.Last();
            var otherUsers = string.Join(", ", userNames.Take(userNames.Count - 1));
            return $"{otherUsers} and {lastUser} have accepted the invite";
        }

        return "AppUsers have accepted the invite";
    }
    
    // Hjelpemetode for å hente gammelt og nytt navn
    private string BuildGroupNameChangedSummary(string actorName, string? metadata)
    {
        if (string.IsNullOrEmpty(metadata))
        {
            return $"{actorName} changed the group name";
        }

        try
        {
            var data = JsonSerializer.Deserialize<Dictionary<string, object>>(metadata);
            if (data != null && data.ContainsKey("oldName") && data.ContainsKey("newName"))
            {
                var oldName = data["oldName"]?.ToString() ?? "";
                var newName = data["newName"]?.ToString() ?? "";
            
                if (string.IsNullOrEmpty(oldName))
                {
                    return $"{actorName} set the group name to \"{newName}\"";
                }
            
                return $"{actorName} changed the group name to \"{newName}\" from \"{oldName}\"";
            }
        }
        catch (JsonException)
        {
            // Fallback hvis JSON parsing feiler
        }
    
        return $"{actorName} changed the group name";
    }
    
}