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
        }

        await _context.SaveChangesAsync();

        // 6️⃣ Send notifikasjoner i bakgrunnen
        _taskQueue.QueueAsync(() => NotifyAndBroadcastGroupRequestAsync(groupRequests, conversation.Id));

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
        // Hent alle participants på én gang
        var existingParticipants = await _context.ConversationParticipants
            .Where(cp => cp.ConversationId == conversationId && userIds.Contains(cp.UserId))
            .Select(cp => cp.UserId)
            .ToListAsync();

        // Hent alle pending requests på én gang
        var pendingRequestUsers = await _context.GroupRequests
            .Where(gr => gr.ConversationId == conversationId && 
                         userIds.Contains(gr.ReceiverId) &&
                         gr.Status == GroupRequestStatus.Pending)
            .Select(gr => gr.ReceiverId)
            .ToListAsync();

        // Filtrer på memory
        return userIds
            .Where(userId => !existingParticipants.Contains(userId) && 
                             !pendingRequestUsers.Contains(userId))
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
    
    private async Task NotifyAndBroadcastGroupRequestAsync(List<GroupRequest> groupRequests, int conversationId)
    {
        using var scope = _scopeFactory.CreateScope();
        var notifSvc = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        // Hent conversation data i background task context
        var conversation = await context.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null) return;

        // 🆕 Send SignalR først (like etter som i SendMessageAsync)
        var signalrTasks = groupRequests.Select(async groupRequest =>
        {
            try
            {
                // 1️⃣ Opprett notifikasjon
                var notification = await notifSvc.CreateGroupRequestNotificationAsync(
                    senderId: groupRequest.SenderId,
                    receiverId: groupRequest.ReceiverId,
                    conversationId: groupRequest.ConversationId,
                    groupRequestId: groupRequest.Id,
                    groupName: conversation.GroupName
                );

                // 2️⃣ Send SignalR for GroupRequest (samme pattern som MessageRequest)
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
                }
            }
            catch (Exception ex)
            {
                // Log feilen, men fortsett med andre invitasjoner
                Console.WriteLine($"Failed to notify user {groupRequest.ReceiverId} about group invitation: {ex.Message}");
            }
        });

        // 🆕 Vent på alle SignalR-kall (samme som i SendMessageAsync)
        await Task.WhenAll(signalrTasks);
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
