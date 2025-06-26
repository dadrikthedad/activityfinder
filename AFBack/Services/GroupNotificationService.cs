using System.Text.Json;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Services;

public class GroupNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;

    public GroupNotificationService(ApplicationDbContext context, IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
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
            
            var affectedUsers = new List<UserSummaryDTO>();
            if (affectedUserIds?.Any() == true)
            {
                affectedUsers = await _context.Users
                    .Where(u => affectedUserIds.Contains(u.Id))
                    .Select(u => new UserSummaryDTO
                    {
                        Id = u.Id,
                        FullName = u.FullName,
                        ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null,
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
                    // 🆕 Hent MessageNotification direkte (GroupEvent type)
                    var notification = await _context.MessageNotifications
                        .Include(n => n.Conversation)
                        .FirstOrDefaultAsync(n => n.UserId == memberId && 
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

                            Console.WriteLine($"✅ Sent GroupNotificationUpdated to member {memberId} for conversation {conversationId}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Failed to send group notification update to user {memberId}: {ex.Message}");
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
            AffectedUserIds = affectedUserIds,
            AffectedUserIdsJson = JsonSerializer.Serialize(affectedUserIds),
            Metadata = metadata,
            CreatedAt = DateTime.UtcNow
        };

        _context.GroupEvents.Add(groupEvent);
        await _context.SaveChangesAsync();

        // 2️⃣ Oppdater GroupNotifications for relevante brukere
        await UpdateGroupNotificationsAsync(conversationId, groupEvent.Id);
        
        // 3️⃣ Send automatisk GroupNotificationUpdates til alle godkjente medlemmer
        await SendGroupNotificationUpdatesAsync(conversationId, new List<int> { actorUserId }, eventType, affectedUserIds);
    }

    private async Task UpdateGroupNotificationsAsync(int conversationId, int newEventId)
    {
        // Finn alle godkjente medlemmer i gruppen (ikke pending)
        var approvedMemberIds = await GetApprovedMembersAsync(conversationId);

        foreach (var memberId in approvedMemberIds)
        {
            // 🆕 Finn eller opprett MessageNotification (GroupEvent type)
            var notification = await _context.MessageNotifications
                .FirstOrDefaultAsync(n => n.UserId == memberId && 
                                          n.ConversationId == conversationId && 
                                          n.Type == NotificationType.GroupEvent && 
                                          !n.IsRead);
            
            if (notification == null)
            {
                // Opprett ny MessageNotification
                notification = new MessageNotification
                {
                    UserId = memberId,
                    ConversationId = conversationId,
                    Type = NotificationType.GroupEvent,
                    EventCount = 1,
                    LastUpdatedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false,
                    GroupEventIds = new List<int> { newEventId }
                };
                _context.MessageNotifications.Add(notification);
            }
            else
            {
                // Oppdater eksisterende notification
                var existingEventIds = notification.GroupEventIds;
                existingEventIds.Add(newEventId);
                
                notification.EventCount = (notification.EventCount ?? 0) + 1;
                notification.LastUpdatedAt = DateTime.UtcNow;
                notification.GroupEventIds = existingEventIds; // Trigger setter
            }
        }
        
        await _context.SaveChangesAsync();
    }
    
    public async Task<MessageNotificationDTO> ConvertToMessageNotificationDTOAsync(MessageNotification notification)
    {
        // Finn den siste hendelsen for å få ActorUser info
        var lastEvent = await _context.GroupEvents
            .Include(ge => ge.ActorUser)
            .ThenInclude(u => u.Profile)
            .Where(ge => notification.GroupEventIds.Contains(ge.Id))
            .OrderByDescending(ge => ge.CreatedAt)
            .FirstOrDefaultAsync();

        // Bygg event summaries
        var events = await _context.GroupEvents
            .Include(ge => ge.ActorUser)
            .Where(ge => notification.GroupEventIds.Contains(ge.Id))
            .OrderBy(ge => ge.CreatedAt)
            .ToListAsync();

        var eventSummaries = await BuildEventSummariesAsync(events);

        // Sjekk rejected status
        var isRejected = await _context.GroupRequests
            .AnyAsync(gr => gr.ConversationId == notification.ConversationId && 
                           gr.ReceiverId == notification.UserId && 
                           gr.Status == GroupRequestStatus.Rejected);

        var groupName = notification.Conversation?.GroupName ?? "Unknown Group";
        
        return new MessageNotificationDTO
        {
            Id = notification.Id,
            Type = NotificationType.GroupEvent,
            CreatedAt = notification.LastUpdatedAt ?? notification.CreatedAt,
            IsRead = notification.IsRead,
            ReadAt = notification.ReadAt,
            MessageId = null,
            ConversationId = notification.ConversationId,
            SenderName = lastEvent?.ActorUser?.FullName,
            SenderId = lastEvent?.ActorUserId,
            SenderProfileImageUrl = lastEvent?.ActorUser?.Profile?.ProfileImageUrl,
            GroupName = groupName,
            GroupImageUrl = notification.Conversation?.GroupImageUrl,
            MessagePreview = (notification.EventCount ?? 0) > 1 
                ? $"There are {notification.EventCount} new activities in \"{groupName}\""
                : $"New activity in \"{groupName}\"",
            ReactionEmoji = null,
            MessageCount = notification.EventCount,
            IsConversationRejected = isRejected,
            IsReactionUpdate = false,
            EventSummaries = eventSummaries
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
            var currentAffectedUserNames = await GetUserNamesAsync(currentEvent.AffectedUserIds);
            
            // 🔄 Konsekutiv gruppering: Samle alle påfølgende like hendelser
            var allAffectedUsers = new List<string>(currentAffectedUserNames);
            int eventsToSkip = 0;
            
            // 🎯 Sjekk kun hendelser som kan grupperes (invite/remove)
            if (currentEvent.EventType == GroupEventType.MemberInvited || 
                currentEvent.EventType == GroupEventType.MemberRemoved)
            {
                // Se framover og samle alle konsekutive like hendelser fra samme actor
                for (int j = i + 1; j < sortedEvents.Count; j++)
                {
                    var nextEvent = sortedEvents[j];
                    
                    // ✅ Samme type OG samme actor = fortsett gruppering
                    if (nextEvent.EventType == currentEvent.EventType && 
                        nextEvent.ActorUserId == currentEvent.ActorUserId)
                    {
                        var nextAffectedUserNames = await GetUserNamesAsync(nextEvent.AffectedUserIds);
                        allAffectedUsers.AddRange(nextAffectedUserNames);
                        eventsToSkip++;
                    }
                    else
                    {
                        // ❌ Annen type event eller annen actor = stopp gruppering
                        break;
                    }
                }
            }
            
            // 📝 Generer summary
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
                    $"{actorName} changed the group name",
                    
                GroupEventType.GroupImageChanged => 
                    $"{actorName} changed the group image",
                    
                GroupEventType.GroupCreated => 
                    $"{actorName} created the group",
                    
                _ => $"{actorName} performed an action"
            };

            summaries.Add(summary);
            
            // ⏭️ Hopp over hendelser vi allerede har behandlet
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

        return "Users have accepted the invite";
    }

    private async Task<List<string>> GetUserNamesAsync(List<int> userIds)
    {
        return await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => u.FullName)
            .ToListAsync();
    }

    
}