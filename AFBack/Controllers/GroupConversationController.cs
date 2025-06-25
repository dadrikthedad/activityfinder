using System.ComponentModel.DataAnnotations;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GroupConversationController : BaseController
{
    private readonly ApplicationDbContext _context;
    private readonly SendMessageCache _msgCache;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<ChatHub> _hubContext;


    public GroupConversationController(ApplicationDbContext context, SendMessageCache msgCache, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _msgCache = msgCache;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
    }

    [HttpPost("send-requests")]
    public async Task<SendGroupRequestsResponseDTO> SendGroupRequestsAsync(SendGroupRequestsDTO request)
    {
        // Henter bruker
        int senderId = GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated");
        
        // 1️⃣ Valider input
        if (request.InvitedUserIds?.Any() != true)
            throw new Exception("Ingen brukere å invitere");
        
        // Sjekker om alle brukerne er med
        await ValidateUsersExistAsync(request.InvitedUserIds.Concat([senderId]));

        // 2️⃣ Finn eller opprett samtale
        var (conversation, isNewConversation) = await GetOrCreateGroupConversationAsync(senderId, request);

        // 3️⃣ Sjekk blokkeringer for alle mottakere
        var blockedUsers = await CheckBlockedUsersAsync(senderId, request.InvitedUserIds);
        if (blockedUsers.Any())
        {
            var blockedNames = string.Join(", ", blockedUsers);
            throw new Exception($"User has blocked you: {blockedNames}");
        }

        // 4️⃣ Filtrer bort brukere som allerede er medlemmer eller har pending invitasjoner
        var validRecipients = await FilterValidRecipientsAsync(conversation.Id, request.InvitedUserIds);
        var alreadyInvited = request.InvitedUserIds.Except(validRecipients).ToList();
        
        if (!validRecipients.Any())
        {
            if (alreadyInvited.Count == 1)
                throw new Exception($"User {alreadyInvited.First()} has already been invited.");
            
            throw new Exception($"Users {string.Join(", ", alreadyInvited)} have already been invited.");
        }

        // 5️⃣ Opprett GroupRequests
        var groupRequests = new List<GroupRequest>();
        var newParticipants = new List<ConversationParticipant>();
        
        foreach (var userId in validRecipients)
        {
            var groupRequest = new GroupRequest
            {
                SenderId = senderId,
                ReceiverId = userId,
                ConversationId = conversation.Id,
                Status = GroupRequestStatus.Pending,
                RequestedAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.GroupRequests.Add(groupRequest);
            groupRequests.Add(groupRequest);
            
            // 🆕 Legg til som Participant ved invitasjon
            var participant = new ConversationParticipant
            {
                ConversationId = conversation.Id,
                UserId = userId
            };

            _context.ConversationParticipants.Add(participant);
            newParticipants.Add(participant);
        }
        
        await _context.SaveChangesAsync();
        
        Console.WriteLine("🟡 Queueing background task for group requests...");
        // 6️⃣ Send notifikasjoner i bakgrunnen
        _taskQueue.QueueAsync(() => NotifyAndBroadcastGroupRequestAsync(groupRequests, conversation.Id, senderId, !isNewConversation));

        return new SendGroupRequestsResponseDTO
        {
            ConversationId = conversation.Id,
            IsNewConversation = isNewConversation,
            InvitationsSent = validRecipients.Count,
            TotalRequestedUsers = request.InvitedUserIds.Count
        };
        
    }
    
    
    // Hjelpefunksjoenr til SendGroupRerquerstsAsync
    
    private async Task ValidateUsersExistAsync(IEnumerable<int> userIds)
    {
        var userIdList = userIds.ToList();
        var existingUsers = await _context.Users
            .Where(u => userIdList.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync();

        var missingUsers = userIdList.Except(existingUsers).ToList();
        if (missingUsers.Any())
            throw new Exception($"Følgende brukere finnes ikke: {string.Join(", ", missingUsers)}");
    }
    
    private async Task<List<string>> CheckBlockedUsersAsync(int senderId, List<int> recipientIds)
    {
        var blockedUsers = new List<string>();

        foreach (var recipientId in recipientIds)
        {
            if (await _msgCache.IsBlockedAsync(recipientId, senderId))
            {
                var user = await _context.Users
                    .Where(u => u.Id == recipientId)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrEmpty(user))
                    blockedUsers.Add(user);
            }
        }

        return blockedUsers;
    }

    private async Task<List<int>> FilterValidRecipientsAsync(int conversationId, List<int> userIds)
    {
        // Hent eksisterende participants
        var existingParticipants = await _context.ConversationParticipants
            .Where(cp => cp.ConversationId == conversationId && userIds.Contains(cp.UserId))
            .Select(cp => cp.UserId)
            .ToListAsync();

        // Hent alle som har GroupRequests (ALLE statuser - inkludert Rejected)
        var existingRequestUsers = await _context.GroupRequests
            .Where(gr => gr.ConversationId == conversationId && 
                         userIds.Contains(gr.ReceiverId))  // 👈 Ingen status-filter
            .Select(gr => gr.ReceiverId)
            .ToListAsync();

        return userIds
            .Where(userId => !existingParticipants.Contains(userId) && 
                             !existingRequestUsers.Contains(userId))
            .ToList();
    }

    private async Task<(Conversation conversation, bool isNewConversation)> GetOrCreateGroupConversationAsync(
        int senderId, SendGroupRequestsDTO request)
    {
        // Hvis ConversationId er oppgitt, bruk eksisterende
        if (request.ConversationId.HasValue)
        {
            var existing = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == request.ConversationId.Value && c.IsGroup);

            if (existing == null)
                throw new Exception("Gruppe ikke funnet");

            // Sjekk at sender er medlem
            var senderParticipant = existing.Participants
                .FirstOrDefault(p => p.UserId == senderId);
            
            if (senderParticipant == null)
                throw new Exception("Du er ikke medlem av denne gruppen eller har ikke akseptert invitasjonen");

            return (existing, false);
        }

        // Opprett ny gruppe
        string groupName;

        if (!string.IsNullOrWhiteSpace(request.GroupName))
        {
            groupName = request.GroupName;
        }
        else
        {
            var invitedUsers = await _context.Users
                .Where(u => request.InvitedUserIds.Contains(u.Id))
                .ToListAsync();

            var invitedNames = invitedUsers
                .Select(u => $"{u.FirstName} {u.LastName}".Trim())
                .ToList();

            // Valgfritt: legg til senderens navn også
            var sender = await _context.Users.FindAsync(senderId);
            if (sender != null)
            {
                invitedNames.Insert(0, $"{sender.FirstName} {sender.LastName}".Trim());
            }

            groupName = string.Join(", ", invitedNames);

            // Begrens lengde hvis ønskelig
            if (groupName.Length > 100)
            {
                groupName = string.Join(", ", invitedNames.Take(3)) + " ...";
            }
        }

        var newConversation = new Conversation
        {
            IsGroup = true,
            GroupName = groupName,
            GroupImageUrl = request.GroupImageUrl,
            CreatorId = senderId,
            IsApproved = true
        };

        _context.Conversations.Add(newConversation);
        await _context.SaveChangesAsync(); // Få ID
        
        var creatorParticipant = new ConversationParticipant
        {
            ConversationId = newConversation.Id,
            UserId = senderId,
        };

        _context.ConversationParticipants.Add(creatorParticipant);
        await _context.SaveChangesAsync();
        
        // 1️⃣ Hent avsender (creator)
        var creator = await _context.Users.FindAsync(senderId);
        var senderName = creator?.FullName ?? "En bruker";

        // 2️⃣ Lag systemmelding
        var introMessage = new Message
        {
            ConversationId = newConversation.Id,
            SenderId = senderId,
            Text = $"{senderName} created the group '{groupName}'",
            SentAt = DateTime.UtcNow,
            IsApproved = true // Så meldingen vises for alle
        };
        _context.Messages.Add(introMessage);

        // 3️⃣ Oppdater LastMessageSentAt
        newConversation.LastMessageSentAt = introMessage.SentAt;
        
        // 4️⃣ (NY) Legg til creator's melding hvis den finnes
        if (!string.IsNullOrWhiteSpace(request.InitialMessage))
        {
            var creatorMessage = new Message
            {
                ConversationId = newConversation.Id,
                SenderId = senderId,
                Text = request.InitialMessage.Trim(),
                SentAt = DateTime.UtcNow.AddMilliseconds(1), // Sørg for riktig rekkefølge
                IsApproved = true,
                // Ikke legg på systemflag eller trigger SignalR
            };
            _context.Messages.Add(creatorMessage);

            // Oppdater LastMessageSentAt om ønskelig
            newConversation.LastMessageSentAt = creatorMessage.SentAt;
        }

        await _context.SaveChangesAsync(); // Lagre både melding og oppdatert conversation

        return (newConversation, true);
    }
    
    private async Task NotifyAndBroadcastGroupRequestAsync(List<GroupRequest> groupRequests, int conversationId, int senderId, bool isExistingGroup)
    {
        using var scope = _scopeFactory.CreateScope();
        var notifSvc = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
        var groupNotifSvc = scope.ServiceProvider.GetRequiredService<GroupNotificationService>();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        // Hent conversation data i background task context
        var conversation = await context.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null) return;

        // 1️⃣ Opprett GroupEvent for invitasjoner (til godkjente medlemmer)
        if (isExistingGroup)
        {
            var invitedUserIds = groupRequests.Select(gr => gr.ReceiverId).ToList();
            await groupNotifSvc.CreateGroupEventAsync(
                GroupEventType.MemberInvited, 
                conversationId, 
                senderId, 
                invitedUserIds);
        }

        // 2️⃣ Send individuelle GroupRequest notifikasjoner til nye inviterte (EKSISTERENDE KODE)
        foreach (var groupRequest in groupRequests)
        {
            try
            {
                // Opprett notifikasjon
                var notification = await notifSvc.CreateGroupRequestNotificationAsync(
                    senderId: groupRequest.SenderId,
                    receiverId: groupRequest.ReceiverId,
                    conversationId: groupRequest.ConversationId,
                    groupRequestId: groupRequest.Id,
                    groupName: conversation.GroupName
                );

                // Send SignalR for GroupRequest
                if (notification != null)
                {
                    await _hubContext.Clients.User(groupRequest.ReceiverId.ToString())
                        .SendAsync("GroupRequestCreated", new GroupRequestCreatedDto
                        {
                            GroupRequestId = groupRequest.Id,
                            SenderId = groupRequest.SenderId,
                            ReceiverId = groupRequest.ReceiverId,
                            ConversationId = groupRequest.ConversationId,
                            GroupName = conversation.GroupName,
                            GroupImageUrl = conversation.GroupImageUrl,
                            CreatorId = conversation.CreatorId,
                            RequestedAt = groupRequest.RequestedAt,
                            Notification = notification
                        });
                
                    Console.WriteLine($"✅ Sent GroupRequestCreated to user {groupRequest.ReceiverId}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to notify user {groupRequest.ReceiverId} about group invitation: {ex.Message}");
            }
        }

        // 3️⃣ Send oppdaterte GroupNotifications til godkjente medlemmer (NY KODE)
        if (isExistingGroup)
        {
            await NotifyExistingGroupMembersAsync(context, conversationId, senderId, groupRequests);
            await SendGroupNotificationUpdatesAsync(conversationId, groupNotifSvc);
        }
    }

        //  Ny metode for å varsle eksisterende gruppemedlemmer
        private async Task NotifyExistingGroupMembersAsync(ApplicationDbContext context, int conversationId, int senderId, List<GroupRequest> groupRequests)
        {
            try
            {
                // 🆕 Hent IDs for de som nettopp ble invitert
                var invitedUserIds = groupRequests.Select(gr => gr.ReceiverId).ToHashSet();
                
                // 🆕 Hent alle som har pending GroupRequests (inkludert de nettopp inviterte)
                var allPendingUserIds = (await context.GroupRequests
                    .Where(gr => gr.ConversationId == conversationId && 
                                 gr.Status == GroupRequestStatus.Pending)
                    .Select(gr => gr.ReceiverId)
                    .ToListAsync())
                    .ToHashSet();
                
                // 🆕 Separer brukere: godkjente medlemmer vs pending medlemmer
                var allParticipantIds = await context.ConversationParticipants
                    .Where(cp => cp.ConversationId == conversationId && cp.UserId != senderId)
                    .Select(cp => cp.UserId)
                    .ToListAsync();

                // Godkjente medlemmer = participants som IKKE har pending requests
                var approvedMemberIds = allParticipantIds
                    .Where(userId => !allPendingUserIds.Contains(userId))
                    .ToList();

                // Pending medlemmer = participants som HAR pending requests (men ikke nylig inviterte)
                var pendingMemberIds = allParticipantIds
                    .Where(userId => allPendingUserIds.Contains(userId) && !invitedUserIds.Contains(userId))
                    .ToList();

                Console.WriteLine($"🔍 Notifying {approvedMemberIds.Count} approved members (with toast) and {pendingMemberIds.Count} pending members (silent) about {invitedUserIds.Count} new invitations");

                // Opprett notifikasjoner kun for godkjente medlemmer
                var notifications = new List<MessageNotificationDTO>();
                if (approvedMemberIds.Any())
                {
                    using var notifScope = _scopeFactory.CreateScope();
                    var notifSvc = notifScope.ServiceProvider.GetRequiredService<MessageNotificationService>();
                    
                    notifications = await notifSvc.CreateGroupRequestInvitedNotificationsAsync(
                        senderId, 
                        conversationId, 
                        approvedMemberIds, 
                        groupRequests.Count);
                }

                // Hent sender info
                var sender = await context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == senderId)
                    .Select(u => new { u.Id, u.FullName })
                    .FirstOrDefaultAsync();

                // Hent info om de inviterte brukerne (for visning i notifikasjon)
                var invitedUsers = await context.Users
                    .AsNoTracking()
                    .Where(u => invitedUserIds.Contains(u.Id))
                    .Select(u => new { u.Id, u.FullName })
                    .ToListAsync();

                var invitedUserNames = invitedUsers.Select(u => u.FullName).ToList();

                // 1️⃣ Send SignalR til godkjente medlemmer (med toast + notifikasjon)
                foreach (var memberId in approvedMemberIds)
                {
                    try
                    {
                        var memberIndex = approvedMemberIds.IndexOf(memberId);
                        var memberNotification = memberIndex < notifications.Count ? notifications[memberIndex] : null;
                        
                        await _hubContext.Clients.User(memberId.ToString())
                            .SendAsync("GroupMemberInvited", new GroupMemberInvitedDto
                            {
                                ConversationId = conversationId,
                                InviterUserId = senderId,
                                InviterName = sender?.FullName ?? "En bruker",
                                InvitedUserIds = invitedUserIds.ToList(),
                                InvitedUserNames = invitedUserNames,
                                InvitedAt = DateTime.UtcNow,
                                Notification = memberNotification,
                                IsSilent = false // 🆕 Godkjente medlemmer får toast
                            });
            
                        Console.WriteLine($"✅ Sent GroupMemberInvited (with toast) to approved member {memberId} about {invitedUserIds.Count} new invitations");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"❌ Failed to send GroupMemberInvited to approved member {memberId}: {ex.Message}");
                    }
                }

                // 2️⃣ Send SignalR til pending medlemmer (silent, ingen notifikasjon)
                foreach (var memberId in pendingMemberIds)
                {
                    try
                    {
                        await _hubContext.Clients.User(memberId.ToString())
                            .SendAsync("GroupMemberInvited", new GroupMemberInvitedDto
                            {
                                ConversationId = conversationId,
                                InviterUserId = senderId,
                                InviterName = sender?.FullName ?? "En bruker",
                                InvitedUserIds = invitedUserIds.ToList(),
                                InvitedUserNames = invitedUserNames,
                                InvitedAt = DateTime.UtcNow,
                                Notification = null, // 🆕 Ingen notifikasjon for pending
                                IsSilent = true // 🆕 Pending medlemmer får ikke toast
                            });
            
                        Console.WriteLine($"✅ Sent GroupMemberInvited (silent) to pending member {memberId} about {invitedUserIds.Count} new invitations");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"❌ Failed to send GroupMemberInvited to pending member {memberId}: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to notify existing group members: {ex.Message}");
            }
        }
        
        
        private async Task SendGroupNotificationUpdatesAsync(int conversationId, GroupNotificationService groupNotifSvc)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    
            try
            {
                // Hent alle godkjente medlemmer
                var approvedMemberIds = await GetApprovedMembersAsync(context, conversationId);

                foreach (var memberId in approvedMemberIds)
                {
                    try
                    {
                        // Hent oppdatert GroupNotification for denne brukeren
                        var notifications = await groupNotifSvc.GetGroupNotificationsAsync(memberId);
                        var relevantNotification = notifications.FirstOrDefault(n => n.ConversationId == conversationId);

                        if (relevantNotification != null)
                        {
                            await _hubContext.Clients.User(memberId.ToString())
                                .SendAsync("GroupNotificationUpdated", new GroupNotificationUpdateDTO
                                {
                                    UserId = memberId,
                                    Notification = relevantNotification,
                                    IsNewNotification = relevantNotification.EventCount == 1
                                });

                            Console.WriteLine($"✅ Sent GroupNotificationUpdated to approved member {memberId} for conversation {conversationId}");
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
        
        private async Task<List<int>> GetApprovedMembersAsync(ApplicationDbContext context, int conversationId)
        {
            // Hent alle participants
            var allParticipantIds = await context.ConversationParticipants
                .Where(cp => cp.ConversationId == conversationId)
                .Select(cp => cp.UserId)
                .ToListAsync();

            // Hent alle som har pending GroupRequests
            var pendingUserIds = await context.GroupRequests
                .Where(gr => gr.ConversationId == conversationId && gr.Status == GroupRequestStatus.Pending)
                .Select(gr => gr.ReceiverId)
                .ToListAsync();

            // Godkjente medlemmer = participants som IKKE har pending requests
            return allParticipantIds.Where(userId => !pendingUserIds.Contains(userId)).ToList();
        }
    
}

// Sendes fra frontend
public class SendGroupRequestsDTO
{
    public int? ConversationId { get; set; } // Null for ny gruppe
    
    [MaxLength(100)]
    public string? GroupName { get; set; } // Påkrevd for nye grupper
    
    [MaxLength(512)]
    public string? GroupImageUrl { get; set; }
    
    [MaxLength(1000)]
    public string? InitialMessage { get; set; }
    
    [Required]
    public List<int> InvitedUserIds { get; set; } = new();
}

// Sendes til frontend til slutt
public class SendGroupRequestsResponseDTO
{
    public int ConversationId { get; set; }
    public bool IsNewConversation { get; set; }
    public int InvitationsSent { get; set; }
    public int TotalRequestedUsers { get; set; }
}

// 🆕 Ny DTO for å varsle eksisterende gruppemedlemmer
public class GroupMemberInvitedDto
{
    public int ConversationId { get; set; }
    public int InviterUserId { get; set; }
    public string InviterName { get; set; } = string.Empty;
    public List<int> InvitedUserIds { get; set; } = new();
    public List<string> InvitedUserNames { get; set; } = new();
    public DateTime InvitedAt { get; set; }
    public MessageNotificationDTO? Notification { get; set; }
    
    public bool? IsSilent { get; set; }
}