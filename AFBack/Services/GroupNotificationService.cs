using System.Text.Json;
using AFBack.Data;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.DTOs;

namespace AFBack.Services;

public class GroupNotificationService
{
    private readonly ApplicationDbContext _context;

    public GroupNotificationService(ApplicationDbContext context)
    {
        _context = context;
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
    }

    private async Task UpdateGroupNotificationsAsync(int conversationId, int newEventId)
    {
        // Finn alle godkjente medlemmer i gruppen (ikke pending)
        var approvedMemberIds = await GetApprovedMembersAsync(conversationId);

        foreach (var memberId in approvedMemberIds)
        {
            // Finn eller opprett GroupNotification for denne brukeren og gruppen
            var notification = await _context.GroupNotifications
                .FirstOrDefaultAsync(gn => gn.UserId == memberId && gn.ConversationId == conversationId && !gn.IsRead);

            if (notification == null)
            {
                // Opprett ny GroupNotification
                notification = new GroupNotification
                {
                    UserId = memberId,
                    ConversationId = conversationId,
                    EventCount = 1,
                    LastUpdatedAt = DateTime.UtcNow,
                    IsRead = false,
                    GroupEventIds = new List<int> { newEventId },
                    GroupEventIdsJson = JsonSerializer.Serialize(new List<int> { newEventId })
                };
                _context.GroupNotifications.Add(notification);
            }
            else
            {
                // Oppdater eksisterende GroupNotification
                notification.EventCount++;
                notification.LastUpdatedAt = DateTime.UtcNow;
                notification.GroupEventIds.Add(newEventId);
                notification.GroupEventIdsJson = JsonSerializer.Serialize(notification.GroupEventIds);
            }
        }

        await _context.SaveChangesAsync();
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

    public async Task<List<GroupNotificationDTO>> GetGroupNotificationsAsync(int userId)
    {
        var notifications = await _context.GroupNotifications
            .Include(gn => gn.Conversation)
            .Where(gn => gn.UserId == userId && !gn.IsRead && gn.EventCount > 0)
            .OrderByDescending(gn => gn.LastUpdatedAt)
            .ToListAsync();

        var result = new List<GroupNotificationDTO>();

        foreach (var notification in notifications)
        {
            // Hent alle gruppehendelser for denne notifikasjonen
            var events = await _context.GroupEvents
                .Include(ge => ge.ActorUser)
                .Where(ge => notification.GroupEventIds.Contains(ge.Id))
                .OrderBy(ge => ge.CreatedAt)
                .ToListAsync();

            var eventSummaries = await BuildEventSummariesAsync(events);

            result.Add(new GroupNotificationDTO
            {
                Id = notification.Id,
                ConversationId = notification.ConversationId,
                GroupName = notification.Conversation?.GroupName ?? "Ukjent gruppe",
                GroupImageUrl = notification.Conversation?.GroupImageUrl,
                EventCount = notification.EventCount,
                LastUpdatedAt = notification.LastUpdatedAt,
                EventSummaries = eventSummaries,
                GroupEventIds = notification.GroupEventIds // 🆕 Legg til GroupEventIds
            });
        }

        return result;
    }

    private async Task<List<string>> BuildEventSummariesAsync(List<GroupEvent> events)
    {
        var summaries = new List<string>();

        // Grupper hendelser av samme type og actor for å minimere tekst
        var groupedEvents = events
            .GroupBy(e => new { e.EventType, e.ActorUserId })
            .OrderBy(g => g.Min(e => e.CreatedAt));

        foreach (var group in groupedEvents)
        {
            var firstEvent = group.First();
            var actorName = firstEvent.ActorUser?.FullName ?? "En bruker";
            
            var allAffectedUserIds = group.SelectMany(e => e.AffectedUserIds).Distinct().ToList();
            var affectedUserNames = await GetUserNamesAsync(allAffectedUserIds);

            string summary = group.Key.EventType switch
            {
                GroupEventType.MemberInvited => $"{actorName} has invited: {string.Join(", ", affectedUserNames)}",
                GroupEventType.MemberAccepted => BuildAcceptedSummary(affectedUserNames),
                GroupEventType.MemberLeft => $"{actorName} has left the group",
                GroupEventType.MemberRemoved => $"{actorName} removed: {string.Join(", ", affectedUserNames)}",
                GroupEventType.GroupNameChanged => $"{actorName} changed the group name",
                GroupEventType.GroupImageChanged => $"{actorName} changed the group image",
                _ => $"{actorName} performed an action"
            };

            summaries.Add(summary);
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

    public async Task MarkGroupNotificationAsReadAsync(int notificationId, int userId)
    {
        var notification = await _context.GroupNotifications
            .FirstOrDefaultAsync(gn => gn.Id == notificationId && gn.UserId == userId);

        if (notification != null)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
    
    public async Task<List<MessageNotificationDTO>> ConvertGroupNotificationsToMessageDTOsAsync(List<GroupNotificationDTO> groupNotifications, HashSet<int> rejectedConversationSet)
    {
        var result = new List<MessageNotificationDTO>();
    
        foreach (var groupNotification in groupNotifications)
        {
            // Finn den siste hendelsen for å få ActorUser info
            var lastEvent = await _context.GroupEvents
                .Include(ge => ge.ActorUser)
                .ThenInclude(u => u.Profile)
                .Where(ge => groupNotification.GroupEventIds.Contains(ge.Id))
                .OrderByDescending(ge => ge.CreatedAt)
                .FirstOrDefaultAsync();

            var dto = new MessageNotificationDTO
            {
                Id = groupNotification.Id,
                Type = NotificationType.GroupEvent,
                CreatedAt = groupNotification.LastUpdatedAt,
                IsRead = false, // GroupNotifications har sin egen IsRead
                ReadAt = null,
                MessageId = null,
                ConversationId = groupNotification.ConversationId,
                SenderName = lastEvent?.ActorUser?.FullName,
                SenderId = lastEvent?.ActorUserId,
                SenderProfileImageUrl = lastEvent?.ActorUser?.Profile?.ProfileImageUrl,
                GroupName = groupNotification.GroupName,
                GroupImageUrl = groupNotification.GroupImageUrl,
                MessagePreview = groupNotification.EventCount > 1 
                    ? $"There are {groupNotification.EventCount} new activities in \"{groupNotification.GroupName}\""
                    : $"New activity in \"{groupNotification.GroupName}\"",
                ReactionEmoji = null,
                MessageCount = groupNotification.EventCount,
                IsConversationRejected = rejectedConversationSet.Contains(groupNotification.ConversationId),
                IsReactionUpdate = false,
                EventSummaries = groupNotification.EventSummaries
            };

            result.Add(dto);
        }

        return result;
    }
    
}