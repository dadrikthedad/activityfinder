using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Extensions;

public static class SyncEventExtensions
{
    // Helper classes
    public class SyncToken
    {
        public DateTime Timestamp { get; set; }
        public int Version { get; set; }
        public int Random { get; set; } // Legg til random-verdien
        public string Hash { get; set; } = string.Empty;
    }
    
    // Hjelpemetoder som mapper existing data (ingen DB kall):
    public static object MapConversationToSyncData(
        this Conversation conversation, 
        int userId, 
        Dictionary<int, (string FullName, string? ProfileImageUrl)> userData,
        Dictionary<int, string>? groupRequestStatuses = null)
    {
        // 🎯 ENKELT: Kun for nye samtaler - bruk alltid userData
        var userIds = conversation.Participants?.Select(p => p.UserId).ToArray() ?? new int[0];
        var participantData = userIds.Select(id => new 
        {
            id = id,
            fullName = userData.TryGetValue(id, out var user) ? user.FullName : null,
            profileImageUrl = userData.TryGetValue(id, out var userImg) ? userImg.ProfileImageUrl : null,
            groupRequestStatus = groupRequestStatuses?.TryGetValue(id, out var status) == true 
                ? status 
                : (object?)null // 🆕 Legg til group status hvis tilgjengelig
        }).ToList<object>();

        return new 
        {
            id = conversation.Id,
            groupName = conversation.GroupName,
            isGroup = conversation.IsGroup,
            groupImageUrl = conversation.GroupImageUrl,
            lastMessageSentAt = conversation.LastMessageSentAt,
            creatorId = conversation.CreatorId,
            participants = participantData,
            isPendingApproval = !conversation.IsApproved && !conversation.IsGroup && conversation.CreatorId == userId,
            isApproved = conversation.IsApproved,
            disbanded = conversation.IsDisbanded,
            disbandedAt = conversation.DisbandedAt
        };
    }
    
    public static object MapToRequestDTO(
        this Conversation conversation, 
        int senderId,
        DateTime requestedAt,
        Dictionary<int, (string FullName, string? ProfileImageUrl)> userData,
        bool isGroupRequest = false,
        Dictionary<int, string>? groupRequestStatuses = null)
    {
        // Hent sender info
        string senderName = userData.TryGetValue(senderId, out var sender) ? sender.FullName : string.Empty;
        string? profileImageUrl = userData.TryGetValue(senderId, out var senderImg) ? senderImg.ProfileImageUrl : null;

        // Bygg participants list hvis det er en gruppe
        List<object>? participants = null;
        if (isGroupRequest && conversation.IsGroup)
        {
            var participantIds = conversation.Participants?.Select(p => p.UserId).ToArray() ?? new int[0];
            participants = participantIds.Select(id => new 
            {
                id = id,
                fullName = userData.TryGetValue(id, out var user) ? user.FullName : null,
                profileImageUrl = userData.TryGetValue(id, out var userImg) ? userImg.ProfileImageUrl : null,
                groupRequestStatus = groupRequestStatuses?.TryGetValue(id, out var status) == true 
                    ? status 
                    : (object?)null // 🆕 Legg til group status hvis tilgjengelig
            }).ToList<object>();
        }

        return new 
        {
            senderId = senderId,
            senderName = senderName,
            profileImageUrl = profileImageUrl,
            requestedAt = requestedAt,
            conversationId = conversation.Id,
            groupName = conversation.IsGroup ? conversation.GroupName : null,
            isGroup = conversation.IsGroup,
            groupImageUrl = conversation.IsGroup ? conversation.GroupImageUrl : null,
            limitReached = false,
            isPendingApproval = true, // Alltid true for requests
            participants = participants
        };
    }
    
    // Hjelpemetode for å hente user data når participants mangler det
    public static async Task<Dictionary<int, (string FullName, string? ProfileImageUrl)>> GetUserDataAsync(
        ApplicationDbContext context, 
        params int[] userIds)
    {
        var users = await context.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Include(u => u.Profile)
            .Select(u => new 
            {
                u.Id,
                u.FullName,
                ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null
            })
            .ToListAsync();

        return users.ToDictionary(
            u => u.Id, 
            u => (u.FullName, u.ProfileImageUrl)
        );
    }
    
    // Hjelpemetode for å bygge conversation sync data
    public static async Task<object> BuildConversationSyncData(
        ApplicationDbContext context, 
        Conversation conversation, 
        int[] participantIds,
        Dictionary<int, string>? groupRequestStatuses = null)
    {
        // Sjekk om vi har participant user data
        bool hasUserData = conversation.Participants?.Any(p => p.User != null) == true;
    
        List<object> participantData;
    
        if (hasUserData)
        {
            // Bruk existing user data
            participantData = conversation.Participants.Select(p => new 
            {
                id = p.UserId,
                fullName = p.User.FullName,
                profileImageUrl = p.User.Profile?.ProfileImageUrl,
                groupRequestStatus = groupRequestStatuses?.TryGetValue(p.UserId, out var status) == true 
                    ? status 
                    : (object?)null
            }).ToList<object>();
        }
        else
        {
            // Hent user data for participants
            var userData = await SyncEventExtensions.GetUserDataAsync(context, participantIds);
        
            participantData = participantIds.Select(id => new 
            {
                id = id,
                fullName = userData.TryGetValue(id, out var user) ? user.FullName : null,
                profileImageUrl = userData.TryGetValue(id, out var userImg) ? userImg.ProfileImageUrl : null,
                groupRequestStatus = groupRequestStatuses?.TryGetValue(id, out var status) == true 
                    ? status 
                    : (object?)null
            }).ToList<object>();
        }
    
        return new 
        {
            id = conversation.Id,
            groupName = conversation.GroupName,
            isGroup = conversation.IsGroup,
            groupImageUrl = conversation.GroupImageUrl,
            lastMessageSentAt = conversation.LastMessageSentAt,
            creatorId = conversation.CreatorId,
            participants = participantData,
            isPendingApproval = false, // Fast path betekent approved
            isApproved = conversation.IsApproved,
            disbanded = conversation.IsDisbanded,
            disbandedAt = conversation.DisbandedAt
        };
    }
    
    public static async Task<Dictionary<int, string>> GetGroupRequestStatusesAsync(
        ApplicationDbContext context, 
        int conversationId, 
        int[] userIds)
    {
        return await context.GroupRequests
            .Where(gr => gr.ConversationId == conversationId && 
                         userIds.Contains(gr.ReceiverId))
            .ToDictionaryAsync(gr => gr.ReceiverId, gr => gr.Status.ToString());
    }
}
