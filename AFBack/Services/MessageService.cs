using AFBack.Controllers;
using AFBack.Data;
using AFBack.Models;
using AFBack.DTOs;
using AFBack.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

// En service for å håndtere alle meldinger
namespace AFBack.Services;

public class MessageService : IMessageService
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly SendMessageCache _msgCache;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UserController> _logger;

    public MessageService(ApplicationDbContext context, IHubContext<ChatHub> hubContext,
        MessageNotificationService messageNotificationService, SendMessageCache msgCache,
        IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, ILogger<UserController> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _messageNotificationService = messageNotificationService;
        _msgCache = msgCache;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _logger = logger;

    }

    // Her sender vi en melding med SendMessageAsync, sender også med vedlegg
    public async Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO dto)
    {
        if (dto.ReceiverId != null && int.TryParse(dto.ReceiverId, out var rid) && rid == senderId) 
            throw new("Du kan ikke sende en melding til deg selv.");
        
        if (dto.ParentMessageId.HasValue)
        {
            var parentExists = await _context.Messages
                .AsNoTracking()
                .AnyAsync(m => m.Id == dto.ParentMessageId.Value);
        
            if (!parentExists)
                throw new Exception("Parent message ikke funnet.");
        }
        
        if (dto.ConversationId > 0)
        {
            var fastValidation = await ValidateExistingConversationFast(senderId, dto.ConversationId);
            if (fastValidation.CanSend)
            {
                // 🎯 HYPER-RASK BANE: Hopp direkte til meldingsopprettelse
                return await CreateAndSaveMessageFast(senderId, dto, fastValidation.Conversation);
            }
        
            // Hvis ikke kan sende, fall tilbake til full validering
        }
        
        // 1️  Finn eller lag samtalen (1 query, ingen commit hvis den finnes)
        var (conversation, receiverId) = dto.ConversationId > 0 
            ? await GetExistingConversation(senderId, dto.ConversationId)
            : await GetOrCreateConversationFast(senderId, dto);
        
        if (!conversation.IsGroup && !receiverId.HasValue)
            throw new InvalidOperationException("receiverId skal være satt i 1–1 samtale.");
        
        // Sjekk cahcen om vi kan sende
        bool canSend = await _msgCache.CanUserSendAsync(senderId, conversation.Id);

        MessageResponseDTO response;
        
        if (!canSend)
        {
            // 2️  Blokkeringssjekk  (treffer cache først)
            if (!conversation.IsGroup)
            {
                // Sjekk om mottaker har blokkert avsenderen
                bool isBlockedByReceiver = await _context.UserBlock
                    .AsNoTracking()
                    .AnyAsync(ub => ub.BlockerId == receiverId.Value && ub.BlockedUserId == senderId);
    
                if (isBlockedByReceiver)
                    throw new Exception("This user has been deleted or is no longer visible, or you lack the required permission to send messages.");

                // Sjekk om avsenderen har blokkert mottakeren
                bool hasBlockedReceiver = await _context.UserBlock
                    .AsNoTracking()
                    .AnyAsync(ub => ub.BlockerId == senderId && ub.BlockedUserId == receiverId.Value);
    
                if (hasBlockedReceiver)
                    throw new Exception("You can't send messages to an user you have blocked.");
            }

            // 3️  Må meldingen godkjennes? (3. og evt. 4. query)
            bool requiresApproval = false;
            bool isRejected = false;
            bool requestSent = false;

            if (conversation.IsGroup)
            {
                // For gruppesamtaler: sjekk GroupRequest eller om bruker er creator
                bool hasApprovedGroupRequest = await _context.GroupRequests.AsNoTracking()
                    .AnyAsync(gr => gr.ConversationId == conversation.Id &&
                                    gr.ReceiverId == senderId &&
                                    gr.Status == GroupRequestStatus.Approved);

                bool isCreator = conversation.CreatorId == senderId;

                requiresApproval = !(hasApprovedGroupRequest || isCreator);

                if (requiresApproval)
                    throw new Exception("Du må godkjenne gruppesamtalen før du kan sende meldinger.");
            }
            else
            {
                // For 1-1 samtaler: bruk den eksisterende metoden
                (requiresApproval, isRejected, requestSent) = await ShouldRequireApprovalFast(
                    senderId, receiverId.Value, conversation);

                if (requiresApproval)
                {
                    if (isRejected && !requestSent)
                    {
                        throw new Exception(
                            "You have rejected this message request. Accept it from /Chat to send a message to this user.");
                    }
                }
            }

            int messageCount = 0;
            bool needsMessageRequestNotification = false; // Flagg for å huske notification

            if (!conversation.IsGroup && requiresApproval)
            {
                //  Teller meldinger **bare** når det trengs
                messageCount = await _context.Messages.AsNoTracking()
                    .CountAsync(m => m.ConversationId == conversation.Id &&
                                     m.SenderId == senderId);

                if (messageCount >= 5)
                {
                    MarkLimitReached(senderId, receiverId, conversation.Id);
                    await _context.SaveChangesAsync();
                    throw new Exception(
                        "You have reached the limit of messages you can send while waiting for the receiver to accept your request.");
                }

                // Sjekk om vi trenger å lage ny MessageRequest
                needsMessageRequestNotification = AddMessageRequestEntityIfMissing(senderId, receiverId, conversation);
            }
            else if (!conversation.IsGroup && !conversation.IsApproved)
            {
                conversation.IsApproved = true;
            }

            // Brukeren svarer på en åpen meldingsforespørsel som de ikke selv har sendt.
            // Dette tolkes som en godkjenning – men bare dersom det faktisk finnes en ubehandlet forespørsel.
            bool nowApproved = false;
            if (!conversation.IsGroup && requiresApproval && !isRejected && !requestSent)
            {
                var existingRequest = await _context.MessageRequests
                    .AsNoTracking()
                    .AnyAsync(r => r.ConversationId == conversation.Id &&
                                   r.ReceiverId == senderId &&
                                   !r.IsAccepted && !r.IsRejected);

                if (existingRequest)
                {
                    await ApproveMessageRequestAsync(senderId, conversation.Id);
                    await AddBothUsersToCanSendAsync(senderId, receiverId.Value, conversation.Id);
                    nowApproved = true;
                }
            }
            else if (!requiresApproval)
            {
                // 🚨 BACKUP: Dette burde ikke skje ofte
                _logger.LogWarning("CanSend backup triggered for user {SenderId} in conversation {ConversationId}. " +
                                   "Consider adding CanSend at the proper time.", senderId, conversation.Id);
    
                await AddUserToCanSendAsync(senderId, conversation.Id, 
                    conversation.IsGroup ? CanSendReason.GroupRequest : CanSendReason.Friendship);
            }

            // 5  Lag selve meldingen
            var message = CreateMessage(senderId, conversation.Id, dto, !requiresApproval);

            if (conversation.Id == 0) // samtalen er ny
                message.Conversation = conversation;
            else
                message.ConversationId = conversation.Id;

            _context.Messages.Add(message);
            conversation.LastMessageSentAt = message.SentAt;

            // 6 ÉN lagring av alt ovenfor
            await _context.SaveChangesAsync();

            // 🆕 Hent meldingen på nytt med full parent data
            response = await MapToResponseDtoOptimized(message.Id);

            if (nowApproved)
            {
                response.IsNowApproved = true;
            }
            
            if (isRejected && requestSent)
            {
                response.IsRejectedRequest = true;
            }

            var participantIds = conversation.Participants
                .Select(p => p.UserId)
                .ToArray();

            // Rett før køing
            var shouldNotify = !requiresApproval || (messageCount > 0 && !isRejected) || nowApproved;
            var isRejectedSender = isRejected && requestSent;

            // NotifyAndBroadcastAsync
            if (shouldNotify || needsMessageRequestNotification || isRejectedSender)
            {
                _taskQueue.QueueAsync(() => NotifyAndBroadcastAsync(
                    conversationId: conversation.Id,
                    isGroup: conversation.IsGroup,
                    groupName: conversation.GroupName,
                    groupImageUrl: conversation.GroupImageUrl,
                    participantIds: participantIds,
                    senderId: senderId,
                    receiverId: receiverId,
                    response: response,
                    shouldSendSignalR: shouldNotify,
                    shouldCreateNotifications: shouldNotify,
                    needsMessageRequestNotification: needsMessageRequestNotification,
                    isRejectedSender: isRejectedSender));
            }
            // 🆕 Marker type så frontend vet hva den skal gjøre

            
        }
        else
        {
            response = await CreateAndSaveMessageFast(senderId, dto, conversation);
        }

        return response;
    }


    // Her henter vi meldinger etter ConversationId
    public async Task<List<MessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int userId,
        int skip = 0, int take = 20)
    {
        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            throw new Exception("Samtalen finnes ikke.");
        
        // ✅ Enkel participant-sjekk for ALLE samtaler (gruppe og private)
        if (conversation.Participants.All(p => p.UserId != userId))
            throw new UnauthorizedAccessException("Du har ikke tilgang til denne samtalen.");



        // 👤 PRIVAT: Begrens til maks 5 hvis ikke godkjent
        if (!conversation.IsGroup && !conversation.IsApproved)
        {
            var creatorId = conversation.CreatorId;
            var otherUserId = conversation.Participants.First(p => p.UserId != userId).UserId;

            bool isCreator = userId == creatorId;

            if (!isCreator)
            {
                // Bruker er ikke creator, og samtalen er ikke godkjent → begrenset visning
                var previewMessages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId)
                    .Include(m => m.Attachments)
                    .Include(m => m.Reactions)
                    .Include(m => m.Sender).ThenInclude(u => u.Profile)
                    .Include(m => m.ParentMessage)
                    .ThenInclude(pm => pm.Sender)    
                    .ThenInclude(s => s.Profile)
                    .OrderByDescending(m => m.SentAt)
                    .ToListAsync();

                var ownMessages = previewMessages.Where(m => m.SenderId == userId).Take(take);
                var otherMessages = previewMessages.Where(m => m.SenderId == otherUserId).Take(5);

                var combined = ownMessages.Concat(otherMessages)
                    .OrderBy(m => m.SentAt)
                    .ToList();

                return combined.Select(MapToResponseForMessagesToConv).ToList();
            }
        }

        // ✅ Full tilgang – hent meldinger normalt
        var messages = await _context.Messages
            .Where(m => m.ConversationId == conversationId)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .Include(m => m.Sender).ThenInclude(u => u.Profile)
            .Include(m => m.ParentMessage)
            .ThenInclude(pm => pm.Sender)    
            .ThenInclude(s => s.Profile)
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        return messages
            .OrderBy(m => m.SentAt)
            .Select(MapToResponseForMessagesToConv)
            .ToList();
    }

    private MessageResponseDTO MapToResponseForMessagesToConv(Message message)
    {
        UserSummaryDTO? parentSender = null;
        if (!message.IsDeleted && message.ParentMessage?.Sender != null)
        {
            parentSender = new UserSummaryDTO
            {
                Id = message.ParentMessage.Sender.Id,
                FullName = message.ParentMessage.Sender.FullName,
                ProfileImageUrl = message.ParentMessage.Sender.Profile?.ProfileImageUrl
            };
        }
    
        return new MessageResponseDTO
        {
            Id = message.Id,
            SenderId = message.SenderId,
            Sender = message.Sender != null ? new UserSummaryDTO
            {
                Id = message.Sender.Id,
                FullName = message.Sender.FullName,
                ProfileImageUrl = message.Sender.Profile?.ProfileImageUrl
            } : null,
            Text = message.IsDeleted ? null : message.Text,
            SentAt = message.SentAt,
            ConversationId = message.ConversationId,
            IsSystemMessage = message.IsSystemMessage,
            IsDeleted = message.IsDeleted,
            Attachments = message.IsDeleted ? new List<AttachmentDto>() : 
                message.Attachments
                    .Where(a => !string.IsNullOrWhiteSpace(a.FileUrl))
                    .Select(a => new AttachmentDto
                    {
                        FileUrl = a.FileUrl,
                        FileType = a.FileType,
                        FileName = a.FileName
                    }).ToList(),
            Reactions = message.IsDeleted ? new List<ReactionDTO>() :
                message.Reactions.Select(r => new ReactionDTO
                {
                    MessageId = r.MessageId,
                    Emoji = r.Emoji,
                    UserId = r.UserId
                }).ToList(),
            ParentMessageId = message.IsDeleted ? null : message.ParentMessageId,
            ParentMessageText = message.IsDeleted ? null : message.ParentMessage?.Text,
            ParentSender = parentSender,
        };
    }

    // Hente alle meldingsforespørsler til en bruker
    public async Task<List<MessageRequestDTO>> GetPendingMessageRequestsAsync(int receiverId)
    {
        // ✅ Hent pending 1-til-1 message requests
        var messageRequests = await _context.MessageRequests
            .Where(r => r.ReceiverId == receiverId && !r.IsAccepted && !r.IsRejected)
            .Include(r => r.Sender).ThenInclude(u => u.Profile)
            .Include(r => r.Conversation)
                .ThenInclude(c => c.Participants) // ✅ Legg til participants
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u.Profile)
            .ToListAsync();

        // ✅ Hent pending gruppe requests
        var groupRequests = await _context.GroupRequests
            .Where(gr => gr.ReceiverId == receiverId && gr.Status == GroupRequestStatus.Pending)
            .Include(gr => gr.Sender).ThenInclude(u => u.Profile)
            .Include(gr => gr.Conversation)
                .ThenInclude(c => c.Participants) // ✅ Legg til participants
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u.Profile)
            .ToListAsync();

        // ✅ Kombiner begge typer requests til samme DTO
        var result = new List<MessageRequestDTO>();

        // Legg til 1-til-1 requests
        result.AddRange(messageRequests.Select(r => new MessageRequestDTO
        {
            SenderId = r.SenderId,
            SenderName = r.Sender.FullName,
            ProfileImageUrl = r.Sender.Profile?.ProfileImageUrl,
            RequestedAt = r.RequestedAt,
            ConversationId = r.ConversationId,
            GroupName = r.Conversation?.GroupName,
            GroupImageUrl = r.Conversation?.GroupImageUrl,
            IsGroup = r.Conversation?.IsGroup ?? false,
            LimitReached = r.LimitReached,
            IsPendingApproval = r.Conversation?.IsApproved == false,
            // ✅ Rett variabel - bruk r.Conversation
            Participants = r.Conversation?.IsGroup == true 
                ? r.Conversation.Participants?.Select(p => new UserSummaryDTO 
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl
                }).ToList()
                : null
        }));

        // Legg til gruppe requests
        result.AddRange(groupRequests.Select(gr => new MessageRequestDTO
        {
            SenderId = gr.SenderId,
            SenderName = gr.Sender.FullName,
            ProfileImageUrl = gr.Sender.Profile?.ProfileImageUrl,
            RequestedAt = gr.RequestedAt,
            ConversationId = gr.ConversationId,
            GroupName = gr.Conversation?.GroupName,
            GroupImageUrl = gr.Conversation?.GroupImageUrl,
            IsGroup = true, // ✅ Alltid true for gruppe requests
            LimitReached = false, // ✅ Ikke relevant for gruppe requests
            IsPendingApproval = true, // ✅ Gruppe requests er alltid pending
            // ✅ Rett variabel - bruk gr.Conversation
            Participants = gr.Conversation?.Participants?.Select(p => new UserSummaryDTO 
            {
                Id = p.User.Id,
                FullName = p.User.FullName,
                ProfileImageUrl = p.User.Profile?.ProfileImageUrl
            }).ToList()
        }));

        // ✅ Sorter etter dato (nyeste først)
        return result.OrderByDescending(r => r.RequestedAt).ToList();
    }


    // Her henter vi og ser meldinger etter vi har godtkjent en meldingsforespørsel
    public async Task ApproveMessageRequestAsync(int receiverId, int conversationId)
    {
        // ✅ Sjekk først hvilken type samtale det er
        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            throw new Exception("The conversation does not exist.");

        bool isGroupRequest = conversation.IsGroup;
        int senderId; // ✅ Definer senderId her

        if (isGroupRequest)
        {
            // ✅ Håndter GroupRequest
            var groupRequest = await _context.GroupRequests
                .FirstOrDefaultAsync(gr => gr.ReceiverId == receiverId && 
                                          gr.ConversationId == conversationId && 
                                          gr.Status == GroupRequestStatus.Pending);

            if (groupRequest == null)
                throw new Exception("Gruppeforespørselen finnes ikke eller er allerede behandlet.");

            groupRequest.Status = GroupRequestStatus.Approved;
            senderId = groupRequest.SenderId; // ✅ Lagre senderId

            // ✅ Legg til brukeren som participant i gruppen
            var existingParticipant = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == receiverId);

            if (!existingParticipant)
            {
                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversationId,
                    UserId = receiverId
                });
            }
        }
        else
        {
            // ✅ Håndter MessageRequest
            var messageRequest = await _context.MessageRequests
                .FirstOrDefaultAsync(r => r.ReceiverId == receiverId && 
                                         r.ConversationId == conversationId &&
                                         !r.IsAccepted && !r.IsRejected);

            if (messageRequest == null)
                throw new Exception("Meldingsforespørselen finnes ikke eller er allerede behandlet.");

            messageRequest.IsAccepted = true;
            messageRequest.IsRejected = false;
            senderId = messageRequest.SenderId; // ✅ Lagre senderId

            // ✅ Marker samtalen som godkjent
            conversation.IsApproved = true;
        }
        
        await _context.SaveChangesAsync();
        
        // ✅ Hent brukeren som godkjenner
        var approver = await _context.Users
                           .FirstOrDefaultAsync(u => u.Id == receiverId)
                       ?? throw new Exception("Godkjenneren ble ikke funnet.");

        // ✅ Send automatisk melding
        var systemMessageText = isGroupRequest
            ? $"{approver.FullName} has joined the group."
            : $"{approver.FullName} has accepted the conversation.";

        await _messageNotificationService.CreateSystemMessageAsync(conversationId, systemMessageText);

        if (isGroupRequest)
        {
            using var scope = _scopeFactory.CreateScope();
            var groupNotifSvc = scope.ServiceProvider.GetRequiredService<GroupNotificationService>();
        
            // 🆕 Opprett GroupEvent for MemberAccepted - dette vil automatisk:
            // - Opprette GroupEvent
            // - Oppdatere GroupNotifications for alle godkjente medlemmer
            // - Sende SendGroupNotificationUpdatesAsync til alle godkjente medlemmer
            await groupNotifSvc.CreateGroupEventAsync(
                GroupEventType.MemberAccepted,
                conversationId,
                receiverId, // receiverId er den som aksepterte
                new List<int> { receiverId } // affected user er den som aksepterte
            );
        }
        else
        {
            // ✅ Håndter MessageRequest som før
            var notification = await _messageNotificationService.CreateMessageRequestApprovedNotificationAsync(
                receiverId, senderId, conversationId);

            await _hubContext.Clients.User(senderId.ToString())
                .SendAsync("MessageRequestApproved", notification);
        }
    }

    // Søke etter meldinger til en samtale
    public async Task<List<MessageResponseDTO>> SearchMessagesInConversationAsync(int conversationId, int userId,
        string query, int skip = 0, int take = 50)
    {
        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            throw new Exception("Samtalen finnes ikke.");

        if (conversation.Participants.All(p => p.UserId != userId))
            throw new UnauthorizedAccessException("Du har ikke tilgang til denne samtalen.");
        
        // ✅ GRUPPE: sjekk GroupRequest for brukeren
        if (conversation.IsGroup)
        {
            // Sjekk om brukeren er creator eller har godkjent GroupRequest
            bool isCreator = conversation.CreatorId == userId;
            bool hasApprovedGroupRequest = false;

            if (!isCreator)
            {
                hasApprovedGroupRequest = await _context.GroupRequests.AnyAsync(gr =>
                    gr.ReceiverId == userId &&
                    gr.ConversationId == conversationId &&
                    gr.Status == GroupRequestStatus.Approved);
            }

            // Hvis verken creator eller godkjent member, ingen tilgang
            if (!isCreator && !hasApprovedGroupRequest)
            {
                throw new UnauthorizedAccessException("Du har ikke godkjent invitasjonen til denne gruppen.");
            }
        }

        // ✅ PRIVAT: Sjekk tilgang for 1-til-1 samtaler
        if (!conversation.IsGroup && !conversation.IsApproved)
        {
            var creatorId = conversation.CreatorId;
            bool isCreator = userId == creatorId;

            if (!isCreator)
            {
                // Sjekk om brukeren har godkjent MessageRequest
                var hasApprovedMessageRequest = await _context.MessageRequests.AnyAsync(mr =>
                    mr.ReceiverId == userId &&
                    mr.ConversationId == conversationId &&
                    mr.IsAccepted);

                if (!hasApprovedMessageRequest)
                {
                    throw new UnauthorizedAccessException("Du må godkjenne samtalen før du kan søke i meldinger.");
                }
            }
        }

        var messages = await _context.Messages
            .Where(m => m.ConversationId == conversationId &&
                        !m.IsDeleted &&
                        (
                            (m.Text != null && EF.Functions.ILike(m.Text, $"%{query}%")) ||
                            m.Attachments.Any(a =>
                                (a.FileName != null && EF.Functions.ILike(a.FileName, $"%{query}%")) ||
                                EF.Functions.ILike(a.FileType, $"%{query}%")
                            )
                        ))
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .Include(m => m.Sender).ThenInclude(u => u.Profile)
            .Include(m => m.ParentMessage)
            .OrderByDescending(m => m.SentAt)
            .Take(take)
            .Skip(skip)
            .ToListAsync();

        return messages.Select(MapToResponseForMessagesToConv).ToList();
    }
    
    
    // Slette meldinger
    public async Task<MessageResponseDTO> SoftDeleteMessageAsync(int messageId, int userId)
    {
        var message = await _context.Messages
            .Include(m => m.Conversation)
            .ThenInclude(c => c.Participants)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
            throw new Exception("Message not found.");

        // 🔒 Autorisation: Kun avsender kan slette sin egen melding
        if (message.SenderId != userId)
            throw new UnauthorizedAccessException("You can only delete your own messages.");
        

        // ✅ Soft delete
        message.IsDeleted = true;
    
        // 🗂️ Fjern vedlegg 
        message.Attachments.Clear();
    
        await _context.SaveChangesAsync();

        // 📤 Hent oppdatert melding via optimalisert metode
        var response = await MapToResponseDtoOptimized(messageId); // 🆕 Pass messageId, ikke message objekt
    
        // Hent participants for SignalR broadcast
        var participantIds = message.Conversation.Participants
            .Select(p => p.UserId)
            .ToArray();

        // Send til alle deltakere
        _taskQueue.QueueAsync(() => NotifyMessageDeleted(
            conversationId: message.ConversationId,
            participantIds: participantIds,
            deletedMessage: response
        ));

        return response;
    }

    // 3. SignalR notification metode
    private async Task NotifyMessageDeleted(
        int conversationId,
        int[] participantIds,
        MessageResponseDTO deletedMessage)
    {
        var signalrTasks = participantIds.Select(async uid =>
        {
            try
            {
                await _hubContext.Clients.User(uid.ToString())
                    .SendAsync("MessageDeleted", new { 
                        conversationId = conversationId,
                        message = deletedMessage 
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send deleted message notification to user {UserId}", uid);
            }
        });

        await Task.WhenAll(signalrTasks);
    }
    
    
    
    
    
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    
    // Hjelpemetoder til SendMessage
    // 1. Kombinert bruker-sjekk – 1 query i stedet for 2.
    private async Task CheckUsersExistAsync(int senderId, int receiverId)
    {
        var usersExist = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == senderId || u.Id == receiverId)
            .Select(u => u.Id)
            .ToListAsync();

        if (!usersExist.Contains(senderId)) throw new Exception("Sender finnes ikke.");
        if (!usersExist.Contains(receiverId)) throw new Exception("Mottaker finnes ikke.");
    }

    // 3. GetOrCreate uten ekstra SaveChanges når samtalen finnes
    private async Task<(Conversation conv, int? receiverId)> GetOrCreateConversationFast(
        int senderId, SendMessageRequestDTO dto)
    {
        if (dto.ConversationId > 0)
        {
            var conv = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == dto.ConversationId);

            if (conv == null)
                throw new Exception("Samtalen finnes ikke.");

            if (conv.Participants.All(p => p.UserId != senderId))
                throw new Exception("Du er ikke medlem av denne samtalen.");

            if (conv.IsGroup)
                return (conv, null);

            int receiverId = conv.Participants.First(p => p.UserId != senderId).UserId;

            if (senderId == receiverId)
                throw new Exception("Du kan ikke sende en melding til deg selv.");

            return (conv, receiverId);
        }

        if (!int.TryParse(dto.ReceiverId, out var recId))
            throw new Exception("Ugyldig mottaker-ID.");

        await CheckUsersExistAsync(senderId, recId);

        var existing = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c =>
                !c.IsGroup &&
                c.Participants.Count == 2 &&
                c.Participants.Any(p => p.UserId == senderId) &&
                c.Participants.Any(p => p.UserId == recId));

        if (existing != null)
            return (existing, recId);

        var convNew = new Conversation
        {
            IsGroup = false,
            CreatorId = senderId,
            Participants = new List<ConversationParticipant>
            {
                new() { UserId = senderId },
                new() { UserId = recId }
            }
        };

        _context.Conversations.Add(convNew);
        return (convNew, recId);
    }

    // 4. Rask approval-sjekk – tar inn Conversation-objektet
    private async Task<(bool requiresApproval, bool isRejected, bool requestSent)> ShouldRequireApprovalFast(
        int senderId, int receiverId, Conversation conv)
    {
        if (conv.IsGroup)
        {
            // 🆕 Sjekk GroupRequest i stedet for MessageRequest
            bool hasApprovedGroupRequest = await _context.GroupRequests.AsNoTracking()
                .AnyAsync(gr => gr.ConversationId == conv.Id &&
                                gr.ReceiverId == senderId &&
                                gr.Status == GroupRequestStatus.Approved);
        
            // 🆕 Eller sjekk om brukeren er creator av gruppen
            bool isCreator = conv.CreatorId == senderId;
        
            // Ikke krev approval hvis bruker har godkjent GroupRequest ELLER er creator
            return (!(hasApprovedGroupRequest || isCreator), false, false);
        }

        if (conv.IsApproved) return (false, false, false);

        // 🆕  Bruk cache
        bool isFriend = await _context.Friends.AsNoTracking()
            .AnyAsync(f => (f.UserId == senderId && f.FriendId == receiverId) ||
                           (f.UserId == receiverId && f.FriendId == senderId));

        // Om de ikke er venner må vi fortsatt sjekke tidligere MessageRequest
        var req = await _context.MessageRequests.AsNoTracking()
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefaultAsync(r =>
                r.ConversationId == conv.Id &&
                ((r.SenderId == senderId && r.ReceiverId == receiverId) ||
                 (r.SenderId == receiverId && r.ReceiverId == senderId)));

        if (isFriend || req?.IsAccepted == true)
            return (false, false, false);


        bool isRejected = req?.IsRejected == true;
        bool requestSent = req?.SenderId == senderId;

        return (true, isRejected, requestSent);
    }

    // 5. Legg bare til en entity – ingen SaveChanges her
    private bool AddMessageRequestEntityIfMissing(int senderId, int? receiverId, Conversation conv)
    {
        bool exists = _context.MessageRequests.Local
                          .Any(r => r.ConversationId == conv.Id &&
                                    ((r.SenderId == senderId && r.ReceiverId == receiverId) ||
                                     (r.SenderId == receiverId && r.ReceiverId == senderId)))
                      ||
                      _context.MessageRequests
                          .AsNoTracking()
                          .Any(r => r.ConversationId == conv.Id &&
                                    ((r.SenderId == senderId && r.ReceiverId == receiverId) ||
                                     (r.SenderId == receiverId && r.ReceiverId == senderId)));

        if (exists) return false; // 🆕 Ingen ny request opprettet

        _context.MessageRequests.Add(new MessageRequest
        {
            SenderId = senderId,
            ReceiverId = receiverId.Value,
            Conversation = conv
        });

        return true; // 🆕 Ny request opprettet
    }

    // 6. Limit-reached markeres, men vi committer senere
    private void MarkLimitReached(int senderId, int? receiverId, int convId)
    {
        var req = _context.MessageRequests
            .FirstOrDefault(r =>
                (r.SenderId == senderId && r.ReceiverId == receiverId) ||
                (r.SenderId == receiverId && r.ReceiverId == senderId));

        if (req != null) req.LimitReached = true;
    }


    public Message CreateMessage(int senderId, int conversationId, SendMessageRequestDTO request, bool isApproved)
    {
        return new Message
        {
            SenderId = senderId,
            ConversationId = conversationId,
            Text = request.Text,
            SentAt = DateTime.UtcNow,
            IsApproved = isApproved,
            ParentMessageId = request.ParentMessageId > 0 ? request.ParentMessageId : null,
            Attachments = request.Attachments?.Select(a => new MessageAttachment
            {
                FileUrl = a.FileUrl,
                FileType = a.FileType,
                FileName = a.FileName
            }).ToList() ?? new List<MessageAttachment>()
        };
    }

    private async Task<MessageResponseDTO> MapToResponseDtoOptimized(int messageId)
    {
        var dto = await _context.Messages
            .AsNoTracking()
            .AsSplitQuery() // unngår tunge join-operasjoner som kan gi dårlig ytelse
            .Where(m => m.Id == messageId)
            .Select(m => new MessageResponseDTO
            {
                Id = m.Id,
                SenderId = m.SenderId,
                Text = m.IsDeleted ? null : m.Text,
                SentAt = m.SentAt,
                ConversationId = m.ConversationId,
                IsDeleted = m.IsDeleted, 
                ParentMessageId = m.IsDeleted ? null : m.ParentMessageId, 
                ParentMessageText = m.IsDeleted ? null : 
                    (m.ParentMessage != null ? m.ParentMessage.Text : null),

                Sender = m.Sender != null ? new UserSummaryDTO
                {
                    Id = m.Sender.Id,
                    FullName = m.Sender.FullName,
                    ProfileImageUrl = m.Sender.Profile != null
                        ? m.Sender.Profile.ProfileImageUrl
                        : null
                } : null,

                ParentSender = m.IsDeleted ? null : 
                    (m.ParentMessage != null && m.ParentMessage.Sender != null
                        ? new UserSummaryDTO
                        {
                            Id = m.ParentMessage.Sender.Id,
                            FullName = m.ParentMessage.Sender.FullName,
                            ProfileImageUrl = m.ParentMessage.Sender.Profile != null
                                ? m.ParentMessage.Sender.Profile.ProfileImageUrl
                                : null
                        }
                        : null),

                Attachments = m.IsDeleted ? new List<AttachmentDto>() :
                    m.Attachments
                        .Select(a => new AttachmentDto
                        {
                            FileUrl = a.FileUrl,
                            FileType = a.FileType,
                            FileName = a.FileName
                        })
                        .ToList(),

                Reactions = m.IsDeleted ? new List<ReactionDTO>() :
                    m.Reactions
                        .Select(r => new ReactionDTO
                        {
                            MessageId = r.MessageId,
                            Emoji = r.Emoji,
                            UserId = r.UserId
                        })
                    .ToList()
            })
            .SingleOrDefaultAsync();

        if (dto is null)
            throw new Exception("Message not found");

        return dto;
    }

   private async Task NotifyAndBroadcastAsync(
    int conversationId,
    bool isGroup,
    string? groupName,
    string? groupImageUrl,
    int[] participantIds,
    int senderId,
    int? receiverId,
    MessageResponseDTO response,
    bool shouldSendSignalR = true,
    bool shouldCreateNotifications = true,
    bool needsMessageRequestNotification = false,
    bool isRejectedSender = false)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        /* 1. Send over SignalR med per-bruker isSilent */
        
        var approvedUsers = new HashSet<int>();
        int? creatorId = null;
        
        if (shouldSendSignalR)
        {
            if (isGroup)
            {
                // Hent både approved users og creator i én gang
                var approvedUsersList = await context.GroupRequests
                    .Where(gr => gr.ConversationId == conversationId && 
                                 participantIds.Contains(gr.ReceiverId) &&
                                 gr.Status == GroupRequestStatus.Approved)
                    .Select(gr => gr.ReceiverId)
                    .ToListAsync();
        
                approvedUsers = approvedUsersList.ToHashSet();
                    
                creatorId = await context.Conversations
                    .Where(c => c.Id == conversationId)
                    .Select(c => c.CreatorId)
                    .FirstOrDefaultAsync();
            }

            var signalrTasks = participantIds.Select(async uid =>
            {
                try
                {
                    // 🆕 Beregn isSilent per bruker
                    bool userIsSilent = false;
                    if (isGroup)
                    {
                        bool isCreator = uid == creatorId;
                        bool hasApproved = approvedUsers.Contains(uid);
                        
                        // Silent hvis ikke creator og ikke approved
                        userIsSilent = !isCreator && !hasApproved;
                    }

                    // 🆕 Opprett kopi av response med bruker-spesifikk isSilent
                    var userResponse = new MessageResponseDTO
                    {
                        Id = response.Id,
                        SenderId = response.SenderId,
                        Sender = response.Sender,
                        Text = response.Text,
                        SentAt = response.SentAt,
                        ConversationId = response.ConversationId,
                        IsSilent = userIsSilent, // 🆕 Per-bruker silent
                        Attachments = response.Attachments,
                        Reactions = response.Reactions,
                        ParentMessageId = response.ParentMessageId,
                        ParentMessageText = response.ParentMessageText,
                        IsNowApproved = response.IsNowApproved,
                        IsRejectedRequest = response.IsRejectedRequest,
                        ParentSender = response.ParentSender
                    };

                    await _hubContext.Clients.User(uid.ToString())
                        .SendAsync("ReceiveMessage", userResponse);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send message to user {UserId}", uid);
                }
            });

            await Task.WhenAll(signalrTasks);
        }
        else if (isRejectedSender)
        {
            await _hubContext.Clients.User(senderId.ToString())
                .SendAsync("ReceiveMessage", response);
        }
        
        var notifSvc = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
        
        /* 2. MessageRequest notification hvis nødvendig */
        if (needsMessageRequestNotification && !isGroup && receiverId.HasValue)
        {
            var notification = await notifSvc.CreateMessageRequestNotificationAsync(
                senderId, receiverId.Value, conversationId);

            // Send SignalR for MessageRequest
            if (notification != null && notification.Type == NotificationType.MessageRequest)
            {
                await _hubContext.Clients.User(receiverId.Value.ToString()).SendAsync("MessageRequestCreated", new MessageRequestCreatedDto
                {
                    SenderId = senderId,
                    ReceiverId = receiverId.Value,
                    ConversationId = conversationId,
                    Notification = notification
                });
            }
        }

        /* 3. Lag notifications kun for approved users i grupper */
        if (!shouldCreateNotifications || isRejectedSender) return;
        
        foreach (var uid in participantIds)
        {
            if (uid == senderId) continue;
        
            // 🆕 For grupper: kun lag notifikasjon hvis bruker har approved
            bool shouldCreateNotification = true;
            if (isGroup)
            {
                // Bruk allerede hentet data
                bool isCreator = uid == creatorId;
                bool hasApproved = approvedUsers.Contains(uid);
            
                shouldCreateNotification = isCreator || hasApproved;
            }
        
            if (shouldCreateNotification)
            {
                await notifSvc.CreateMessageNotificationAsync(
                    recipientUserId: uid,
                    senderUserId: senderId,
                    conversationId: conversationId,
                    messageId: response.Id);
            }
        }
    }
   
    // 🚀 RASK VALIDERING for eksisterende samtaler
    private async Task<(bool CanSend, Conversation Conversation)> ValidateExistingConversationFast(int senderId, int conversationId)
    {
        // 1. Sjekk cache først (lynraskt) - dette garanterer membership!
        bool canSend = await _msgCache.CanUserSendAsync(senderId, conversationId);
    
        if (canSend)
        {
            // 2. Hent minimal conversation data (kun det vi trenger)
            var conversation = await _context.Conversations
                .AsNoTracking()
                .Select(c => new Conversation
                {
                    Id = c.Id,
                    IsGroup = c.IsGroup,
                    IsApproved = c.IsApproved,
                    CreatorId = c.CreatorId,
                    GroupName = c.GroupName,
                    GroupImageUrl = c.GroupImageUrl,
                    LastMessageSentAt = c.LastMessageSentAt,
                    IsDisbanded = c.IsDisbanded
                })
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conversation == null || conversation.IsDisbanded)
                return (false, null!);

            // ✅ Ingen membership-sjekk nødvendig - CanSend garanterer dette!
            return (true, conversation);
        }

        return (false, null!);
    }
    
    // 🎯 HYPER-RASK meldingsopprettelse (hopper over det meste)
    private async Task<MessageResponseDTO> CreateAndSaveMessageFast(int senderId, SendMessageRequestDTO dto, Conversation conversation)
    {
        // Opprett melding direkte - vi vet brukeren kan sende
        var message = CreateMessage(senderId, conversation.Id, dto, isApproved: true);
    
        _context.Messages.Add(message);
    
        // 🎯 Intelligent conversation oppdatering
        var existingEntry = _context.Entry(conversation);
        if (existingEntry.State == EntityState.Detached)
        {
            // Conversation er ikke tracked - attach og marker som modified
            _context.Conversations.Attach(conversation);
            conversation.LastMessageSentAt = message.SentAt;
            
        }
        else
        {
            // Conversation er allerede tracked - bare oppdater
            conversation.LastMessageSentAt = message.SentAt;
        }

        // Lagre alt i én transaksjon
        await _context.SaveChangesAsync();
    
        // Hent respons
        var response = await MapToResponseDtoOptimized(message.Id);
    
        // Hent participants for notifikasjoner
        var participantIds = await _context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.ConversationId == conversation.Id)
            .Select(cp => cp.UserId)
            .ToArrayAsync();
    
        // Send notifikasjoner
        _taskQueue.QueueAsync(() => NotifyAndBroadcastAsync(
            conversationId: conversation.Id,
            isGroup: conversation.IsGroup,
            groupName: conversation.GroupName,
            groupImageUrl: conversation.GroupImageUrl,
            participantIds: participantIds,
            senderId: senderId,
            receiverId: null,
            response: response));
    
        return response;
    }

    // Hjelpemetode for å hente eksisterende samtale
    private async Task<(Conversation conv, int? receiverId)> GetExistingConversation(int senderId, int conversationId)
    {
        var conv = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conv == null)
            throw new Exception("Samtalen finnes ikke.");

        if (conv.Participants.All(p => p.UserId != senderId))
            throw new Exception("Du er ikke medlem av denne samtalen.");

        if (conv.IsGroup)
            return (conv, null);

        int receiverId = conv.Participants.First(p => p.UserId != senderId).UserId;
        return (conv, receiverId);
    }
    
    // Legger brukerne til godkjent ved godkjent meldingsforespørsel
    private async Task AddUserToCanSendAsync(int userId, int conversationId, CanSendReason reason)
    {
        var canSend = new CanSend
        {
            UserId = userId,
            ConversationId = conversationId,
            Reason = reason
        };
    
        _context.CanSend.Add(canSend);
        await _msgCache.OnCanSendAddedAsync(userId, conversationId, canSend);
    }
    
    // Legger begge brukerne til ved godkjent meldingsforespørsel
    private async Task AddBothUsersToCanSendAsync(int senderId, int receiverId, int conversationId)
    {
        var senderCanSend = new CanSend
        {
            UserId = senderId,
            ConversationId = conversationId,
            Reason = CanSendReason.MessageRequest
        };
    
        var receiverCanSend = new CanSend
        {
            UserId = receiverId,
            ConversationId = conversationId,
            Reason = CanSendReason.MessageRequest
        };
    
        _context.CanSend.AddRange(senderCanSend, receiverCanSend);
        await _msgCache.OnCanSendAddedAsync(senderId, conversationId, senderCanSend);
        await _msgCache.OnCanSendAddedAsync(receiverId, conversationId, receiverCanSend);
    }


       
}