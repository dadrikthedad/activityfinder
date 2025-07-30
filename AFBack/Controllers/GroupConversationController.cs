using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Functions;
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
    private readonly IHubContext<UserHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly ILogger<GroupConversationController> _logger;
    private readonly GroupNotificationService _groupNotificationService;



    public GroupConversationController(ApplicationDbContext context, ILogger<GroupConversationController> logger, SendMessageCache msgCache, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, IHubContext<UserHub> hubContext, MessageNotificationService messageNotificationService, GroupNotificationService groupNotificationService)
    {
        _logger = logger;
        _context = context;
        _msgCache = msgCache;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _messageNotificationService = messageNotificationService;
        _groupNotificationService = groupNotificationService;
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
        var blockedUsers = await CheckBlockedUsersAsyncOptimized(senderId, request.InvitedUserIds);
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
    
    private async Task<List<string>> CheckBlockedUsersAsyncOptimized(int senderId, List<int> recipientIds)
    {
        var blockedUserNames = await _context.UserBlock
            .AsNoTracking()
            .Where(ub => recipientIds.Contains(ub.BlockerId) && 
                         ub.BlockedUserId == senderId)
            .Join(_context.Users,
                ub => ub.BlockerId,
                u => u.Id,
                (ub, u) => u.FullName)
            .ToListAsync();

        return blockedUserNames;
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
        
        var creatorCanSend = new CanSend
        {
            ConversationId = newConversation.Id,
            UserId = senderId,
            ApprovedAt = DateTime.UtcNow,
            Reason = CanSendReason.GroupRequestCreator,
            LastUpdated = DateTime.UtcNow
        };
        _context.CanSend.Add(creatorCanSend);
        
        var creatorRequest = new GroupRequest
        {
            SenderId = senderId,
            ReceiverId = senderId,
            ConversationId = newConversation.Id,
            Status = GroupRequestStatus.Creator,
            RequestedAt = DateTime.UtcNow,
            IsRead = true
        };
        _context.GroupRequests.Add(creatorRequest);

       
        await _context.SaveChangesAsync();
        
        
        
        // 1️⃣ Hent creator navn
        var creator = await _context.Users.FindAsync(senderId);
        var senderName = creator?.FullName ?? "En bruker";

        // 2️⃣ Lag systemmelding med hjelpefunksjon (inkluderer automatisk SignalR)
        await _messageNotificationService.CreateSystemMessageAsync(
            newConversation.Id,
            $"{senderName} has created the group"
        );
        
        // 3️⃣ Legg til creator's melding hvis den finnes
        if (!string.IsNullOrWhiteSpace(request.InitialMessage))
        {
            var creatorMessage = new Message
            {
                ConversationId = newConversation.Id,
                SenderId = senderId,
                Text = request.InitialMessage.Trim(),
                SentAt = DateTime.UtcNow,
                IsApproved = true,
                IsSystemMessage = false // 🆕 Eksplisitt vanlig melding
            };
            _context.Messages.Add(creatorMessage);

            // Oppdater LastMessageSentAt til creator's message
            newConversation.LastMessageSentAt = creatorMessage.SentAt;
            await _context.SaveChangesAsync();
        }

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

        // 🆕 Lag systemmelding for invitasjoner til eksisterende gruppe
        if (isExistingGroup && groupRequests.Any())
        {
            // Hent inviter navn
            var inviter = await context.Users
                .Where(u => u.Id == senderId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync();

            // Hent inviterte brukere navn
            var invitedUserIds = groupRequests.Select(gr => gr.ReceiverId).ToList();
            var invitedUsers = await context.Users
                .Where(u => invitedUserIds.Contains(u.Id))
                .Select(u => u.FullName)
                .ToListAsync();
            

            // Generer systemmelding-tekst
            string systemMessageText;
            if (invitedUsers.Count == 1)
            {
                systemMessageText = $"{inviter} has invited {invitedUsers[0]}";
            }
            else if (invitedUsers.Count == 2)
            {
                systemMessageText = $"{inviter} has invited {invitedUsers[0]} and {invitedUsers[1]}";
            }
            else
            {
                var lastUser = invitedUsers.Last();
                var otherUsers = string.Join(", ", invitedUsers.Take(invitedUsers.Count - 1));
                systemMessageText = $"{inviter} has invited {otherUsers} and {lastUser}";
            }

            // Lag systemmelding (inkluderer automatisk SignalR)
            await notifSvc.CreateSystemMessageAsync(conversationId, systemMessageText, excludeUserIds: invitedUserIds);
        }

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

        // 2️⃣ Send individuelle GroupRequest notifikasjoner til nye inviterte
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
        
        // 3️⃣ Send GroupParticipantsUpdated til eksisterende inviterte medlemmer som ikke har akseptert
        var newlyInvitedUserIds = groupRequests.Select(gr => gr.ReceiverId).ToList();

        var existingPendingUserIds = await context.GroupRequests
            .Where(gr => gr.ConversationId == conversationId && 
                         gr.Status == GroupRequestStatus.Pending &&
                         !newlyInvitedUserIds.Contains(gr.ReceiverId))
            .Select(gr => gr.ReceiverId.ToString())
            .ToListAsync();

        if (existingPendingUserIds.Any())
        {
            await _hubContext.Clients.Users(existingPendingUserIds)
                .SendAsync("GroupParticipantsUpdated", new
                {
                    ConversationId = conversationId
                });

            Console.WriteLine($"🔁 Sent GroupParticipantsUpdated to existing pending members: {string.Join(", ", existingPendingUserIds)}");
        }
    }
    
    [HttpPost("leave-group")]
    public async Task<IActionResult> LeaveGroupAsync([FromBody] int conversationId)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized();

        try
        {
            // 1️⃣ Valider at gruppen finnes
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.IsGroup);

            if (conversation == null)
                return NotFound(new { message = "Gruppen finnes ikke." });

            // 2️⃣ Sjekk at brukeren er medlem av gruppen
            var participant = conversation.Participants
                .FirstOrDefault(p => p.UserId == userId.Value);

            if (participant == null)
                return BadRequest(new { message = "Du er ikke medlem av denne gruppen." });
            
            bool wasCreator = conversation.CreatorId == userId.Value;
            
            // 3️⃣ Håndter creator som forlater (tildel ny creator)
            if (conversation.CreatorId == userId.Value)
            {
                await HandleCreatorLeavingAsync(conversation, userId.Value);
            }

            // 4️⃣ Fjern bruker fra participants
            _context.ConversationParticipants.Remove(participant);
            
            // Fjernes fra CanSend
            await _context.RemoveCanSendAsync(userId.Value, conversationId, _msgCache);

            // 5️⃣ Sett brukerens GroupRequest til Rejected
            var userGroupRequest = await _context.GroupRequests
                .FirstOrDefaultAsync(gr => gr.ConversationId == conversationId && gr.ReceiverId == userId.Value);

            if (userGroupRequest != null)
            {
                userGroupRequest.Status = GroupRequestStatus.Rejected;
                userGroupRequest.IsRead = true; // 🆕 Marker som lest
            }

            // 🆕 6️⃣ Marker relaterte MessageNotifications som lest
            var relatedNotifications = await _context.MessageNotifications
                .Where(n => n.UserId == userId.Value && 
                            n.ConversationId == conversationId && 
                            (n.Type == NotificationType.GroupRequest || n.Type == NotificationType.GroupEvent) &&
                            !n.IsRead)
                .ToListAsync();

            foreach (var notification in relatedNotifications)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // 7️⃣ Hent bruker-navn for systemmelding
            var user = await _context.Users
                .Where(u => u.Id == userId.Value)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync();

            // 8️⃣ Lag systemmelding
            if (!wasCreator)
            {
                await _messageNotificationService.CreateSystemMessageAsync(
                    conversationId,
                    $"{user} has left the conversation"
                );
            }

            // 9️⃣ Opprett GroupEvent for å notifisere gjenværende medlemmer
            _taskQueue.QueueAsync(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var groupNotifSvc = scope.ServiceProvider.GetRequiredService<GroupNotificationService>();
                
                await groupNotifSvc.CreateGroupEventAsync(
                    GroupEventType.MemberLeft,
                    conversationId,
                    userId.Value, // ActorUserId - den som forlot
                    new List<int> { userId.Value } // AffectedUsers - den som forlot
                );
            });

            return Ok(new { message = "Du har forlatt gruppen." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
    
    // 🆕 Oppdatert hjelpemetode for creator-overføring
    private async Task HandleCreatorLeavingAsync(Conversation conversation, int creatorId)
    {
        // Hent creator navn først
        var creatorUser = await _context.Users
            .Where(u => u.Id == creatorId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync();
        
        // Finn en ny creator blant gjenværende godkjente medlemmer
        var approvedMemberIds = await _context.ConversationParticipants
            .Where(cp => cp.ConversationId == conversation.Id && cp.UserId != creatorId)
            .Select(cp => cp.UserId)
            .ToListAsync();

        // Filtrer bort pending medlemmer
        var pendingUserIds = await _context.GroupRequests
            .Where(gr => gr.ConversationId == conversation.Id && gr.Status == GroupRequestStatus.Pending)
            .Select(gr => gr.ReceiverId)
            .ToListAsync();

        var eligibleMembers = approvedMemberIds.Where(id => !pendingUserIds.Contains(id)).ToList();

        if (eligibleMembers.Any())
        {
            // Velg den første godkjente medlemmet som ny creator
            var newCreatorId = eligibleMembers.First();
            conversation.CreatorId = newCreatorId;

            // Lag systemmelding om ny creator
            var newCreatorUser = await _context.Users
                .Where(u => u.Id == newCreatorId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync();

            await _messageNotificationService.CreateSystemMessageAsync(
                conversation.Id,
                $"{creatorUser} has left the conversation\n{newCreatorUser} is now the group admin"
            );
        }
        else
        {
            // 🆕 Sjekk om det finnes pending invitasjoner
            var hasPendingInvites = pendingUserIds.Any();
            
            if (hasPendingInvites)
            {
                // 🆕 Disbanded gruppe - notifiser pending brukere først
                Console.WriteLine($"💥 Disbanding gruppe {conversation.Id} '{conversation.GroupName}' - {pendingUserIds.Count} pending invitasjoner kanselleres");
                
                // Send disbanded notifikasjoner til alle pending brukere
                await NotifyGroupDisbandedAsync(conversation, pendingUserIds);
                
                // Slett gruppen etter notifikasjoner er sendt
                await MarkGroupAsDisbandedAsync(conversation);
            }
            else
            {
                // Ingen medlemmer og ingen pending invitasjoner - slett stille
                await MarkGroupAsDisbandedAsync(conversation);
            }
        }
    }

    // 🆕 Ny metode for å notifisere om disbanded gruppe
    private async Task NotifyGroupDisbandedAsync(Conversation conversation, List<int> pendingUserIds)
    {
        try
        {
            // Send disbanded notifikasjoner til alle pending brukere
            foreach (var userId in pendingUserIds)
            {
                try
                {
                    // Opprett disbanded notifikasjon
                    var notification = new MessageNotification
                    {
                        UserId = userId,
                        ConversationId = conversation.Id,
                        Type = NotificationType.GroupDisbanded,
                        CreatedAt = DateTime.UtcNow,
                        IsRead = false,
                        MessageCount = 1
                    };

                    _context.MessageNotifications.Add(notification);
                    await _context.SaveChangesAsync(); // Lagre for å få ID

                    // 🆕 Send SignalR om disbanded gruppe
                    await _hubContext.Clients.User(userId.ToString())
                        .SendAsync("GroupDisbanded", new GroupDisbandedDto
                        {
                            ConversationId = conversation.Id,
                            GroupName = conversation.GroupName,
                            GroupImageUrl = conversation.GroupImageUrl,
                            DisbandedAt = DateTime.UtcNow,
                            Notification = new MessageNotificationDTO
                            {
                                Id = notification.Id,
                                Type = NotificationType.GroupDisbanded,
                                ConversationId = conversation.Id,
                                GroupName = conversation.GroupName,
                                GroupImageUrl = conversation.GroupImageUrl,
                                MessagePreview = $"Group '{conversation.GroupName}' has been disbanded",
                                CreatedAt = notification.CreatedAt,
                                IsRead = false,
                                IsConversationRejected = true // 🆕 Marker som rejected/disbanded
                            }
                        });

                    Console.WriteLine($"📨 Sent disbanded notification to user {userId}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Failed to notify user {userId} about disbanded group: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Feil ved disbanded notifikasjoner for gruppe {conversation.Id}: {ex.Message}");
        }
    }
    
    private async Task MarkGroupAsDisbandedAsync(Conversation conversation)
    {
        try
        {
            Console.WriteLine($"💥 Markerer gruppe {conversation.Id} '{conversation.GroupName}' som disbanded");

            // Marker conversation som disbanded
            conversation.IsDisbanded = true;
            conversation.DisbandedAt = DateTime.UtcNow;

            // Sett alle GroupRequests til Rejected
            var groupRequests = await _context.GroupRequests
                .Where(gr => gr.ConversationId == conversation.Id)
                .ToListAsync();

            foreach (var request in groupRequests)
            {
                request.Status = GroupRequestStatus.Rejected;
            }

            // Fjern alle participants (de har allerede forlatt)
            var participants = await _context.ConversationParticipants
                .Where(cp => cp.ConversationId == conversation.Id)
                .ToListAsync();
            _context.ConversationParticipants.RemoveRange(participants);

            Console.WriteLine($"✅ Gruppe {conversation.Id} markert som disbanded - bevares i 30 dager");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Feil ved markering av disbanded gruppe {conversation.Id}: {ex.Message}");
            throw;
        }
    }
    
    // Sletting av en gruppesamtale ikke i bruk atm
    private async Task DeleteEmptyGroupAsync(Conversation conversation)
    {
        try
        {
            Console.WriteLine($"🗑️ Sletter tom gruppe {conversation.Id} '{conversation.GroupName}'");

            // 1️⃣ Slett i riktig rekkefølge (foreign keys)
            
            // Slett GroupEventAffectedUsers først
            var affectedUsers = await _context.GroupEventAffectedUsers
                .Where(geau => _context.GroupEvents
                    .Where(ge => ge.ConversationId == conversation.Id)
                    .Select(ge => ge.Id)
                    .Contains(geau.GroupEventId))
                .ToListAsync();
            _context.GroupEventAffectedUsers.RemoveRange(affectedUsers);

            // Slett MessageNotificationGroupEvents
            var notificationGroupEvents = await _context.MessageNotificationGroupEvents
                .Where(mnge => _context.GroupEvents
                    .Where(ge => ge.ConversationId == conversation.Id)
                    .Select(ge => ge.Id)
                    .Contains(mnge.GroupEventId))
                .ToListAsync();
            _context.MessageNotificationGroupEvents.RemoveRange(notificationGroupEvents);

            // Slett GroupEvents
            var groupEvents = await _context.GroupEvents
                .Where(ge => ge.ConversationId == conversation.Id)
                .ToListAsync();
            _context.GroupEvents.RemoveRange(groupEvents);

            // Slett Reactions (foreign key til Messages)
            var reactions = await _context.Reactions
                .Where(r => _context.Messages
                    .Where(m => m.ConversationId == conversation.Id)
                    .Select(m => m.Id)
                    .Contains(r.MessageId))
                .ToListAsync();
            _context.Reactions.RemoveRange(reactions);

            // Slett MessageAttachments
            var attachments = await _context.MessageAttachments
                .Where(ma => _context.Messages
                    .Where(m => m.ConversationId == conversation.Id)
                    .Select(m => m.Id)
                    .Contains(ma.MessageId))
                .ToListAsync();
            _context.MessageAttachments.RemoveRange(attachments);

            // Slett Messages
            var messages = await _context.Messages
                .Where(m => m.ConversationId == conversation.Id)
                .ToListAsync();
            _context.Messages.RemoveRange(messages);

            // Slett GroupRequests
            var groupRequests = await _context.GroupRequests
                .Where(gr => gr.ConversationId == conversation.Id)
                .ToListAsync();
            _context.GroupRequests.RemoveRange(groupRequests);

            // Slett ConversationParticipants
            var participants = await _context.ConversationParticipants
                .Where(cp => cp.ConversationId == conversation.Id)
                .ToListAsync();
            _context.ConversationParticipants.RemoveRange(participants);

            // Slett Conversation sist
            _context.Conversations.Remove(conversation);

            // Log statistikk
            Console.WriteLine($"✅ Slettet gruppe {conversation.Id}: {messages.Count} meldinger, {groupRequests.Count} forespørsler");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Feil ved sletting av gruppe {conversation.Id}: {ex.Message}");
            throw; // Re-throw for å stoppe transaksjonen
        }
    }
    
    [HttpPut("update-group-name")]
    public async Task<IActionResult> UpdateGroupName(int groupId, string newName)
    {
        if (GetUserId() is not int userId)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(newName) || newName.Length > 100)
            return BadRequest("Group name must be between 1 and 100 characters");

        var group = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == groupId && c.IsGroup);
    
        if (group == null)
            return NotFound("Group not found");

        var isParticipant = group.Participants.Any(p => p.UserId == userId);
        var isCreator = group.CreatorId == userId;
    
        if (!isParticipant && !isCreator)
            return Forbid("You don't have permission to update this group");
        
        if (group.GroupName?.Trim() == newName.Trim())
            return BadRequest("Group name is already set to this value");
        
        var oldName = group.GroupName;
        group.GroupName = newName.Trim();
        await _context.SaveChangesAsync();

        var userName = await _context.Users
            .Where(u => u.Id == userId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? "En bruker";

        // Send system message
        await _messageNotificationService.CreateSystemMessageAsync(
            groupId,
            $"{userName} changed the group name from \"{oldName}\" to \"{newName}\""
        );
        
        // Send metadata med gamle og nye navn for å lage det oversiktelig i eventen
        var metadata = JsonSerializer.Serialize(new
        {
            oldName = oldName ?? "",
            newName = newName.Trim()
        });
        
        await _groupNotificationService.CreateGroupEventAsync(
            GroupEventType.GroupNameChanged,
            groupId,
            userId,
            new List<int> { userId },
            metadata
        );

        _logger.LogInformation("User {UserId} updated group {GroupId} name to: {NewName}", userId, groupId, newName);
    
        return Ok(new { success = true });
    }
    
    [HttpDelete("group-request/{conversationId}")]
    public async Task<IActionResult> DeleteGroupRequestAsync(int conversationId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        
        try
        {
            // 1️⃣ Finn GroupRequest først
            var groupRequest = await _context.GroupRequests
                .FirstOrDefaultAsync(gr => gr.ConversationId == conversationId && 
                                           gr.ReceiverId == userId.Value);

            if (groupRequest == null)
                return NotFound(new { message = "Ingen grupperequest funnet." });

            // 2️⃣ Sjekk spesielle statuser tidlig
            if (groupRequest.Status == GroupRequestStatus.Pending)
                return BadRequest(new { message = "Kan ikke slette en pending request. Avslå den først." });

            if (groupRequest.Status == GroupRequestStatus.Creator)
                return BadRequest(new { message = "Kan ikke slette creator request." });

            // 3️⃣ Sjekk conversation-status
            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.IsGroup);

            bool conversationExists = conversation != null && !conversation.IsDisbanded;

            // 4️⃣ Hvis gruppen fortsatt eksisterer, valider medlemskap
            if (conversationExists)
            {
                var isStillMember = await _context.ConversationParticipants
                    .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId.Value);

                if (isStillMember)
                    return BadRequest(new { message = "Du må først forlate gruppen." });
            }

            // 5️⃣ Slett requesten
            _context.GroupRequests.Remove(groupRequest);

            await _context.SaveChangesAsync();

            // 7️⃣ Returner forskjellig melding basert på gruppe-status
            if (conversationExists)
            {
                return Ok(new { message = "Grouprequest deleted. You can now be invited again." });
            }
            else
            {
                return Ok(new { message = "Grouprequest deleted. The group no longer exists." });
            }
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
        
}