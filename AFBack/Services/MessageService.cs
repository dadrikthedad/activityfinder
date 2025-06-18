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
        
        // 1️⃣  Finn eller lag samtalen (1 query, ingen commit hvis den finnes)
        var (conversation, receiverId) = await GetOrCreateConversationFast(senderId, dto);
        
        if (!conversation.IsGroup && !receiverId.HasValue)
            throw new InvalidOperationException("receiverId skal være satt i 1–1 samtale.");

        // 2️⃣  Blokkeringssjekk  (treffer cache først)
        if (!conversation.IsGroup)
        {
            if (await _msgCache.IsBlockedAsync(receiverId.Value, senderId))
                throw new Exception("Du har ikke tilgang til å sende melding til denne brukeren.");
        }

        // 3️⃣  Må meldingen godkjennes? (3. og evt. 4. query)
        (bool requiresApproval, bool isRejected, bool requestSent) = await ShouldRequireApprovalFast(
            senderId,  receiverId.Value, conversation);

        if (!conversation.IsGroup && requiresApproval)
        {
            if (isRejected && !requestSent) 
            {
                // 🚨 Scenario 1: JEG har avslått den andre - BLOKKÉR helt
                throw new Exception("You have rejected this message request. Accept it from /Chat to send a message to this user."); // TODO: Link Her!
            }
        }
        
        /* === 3a. Gruppe: avsender må ha godkjent på forhånd === */
        if (conversation.IsGroup && requiresApproval)
            throw new Exception("Du må godkjenne gruppesamtalen før du kan sende meldinger.");

        int messageCount = 0;
        bool needsMessageRequestNotification = false; // 🆕 Flagg for å huske notification

        if (!conversation.IsGroup && requiresApproval)
        {
            // 4️⃣  Teller meldinger **bare** når det trengs
            messageCount = await _context.Messages.AsNoTracking()
                .CountAsync(m => m.ConversationId == conversation.Id &&
                                 m.SenderId == senderId);

            if (messageCount >= 5)
            {
                MarkLimitReached(senderId, receiverId, conversation.Id);
                await _context.SaveChangesAsync();
                throw new Exception("You have reached the limit of messages you can send while waiting for the receiver to accept your request.");
            }

            // 🆕 Sjekk om vi trenger å lage ny MessageRequest
            needsMessageRequestNotification = AddMessageRequestEntityIfMissing(senderId, receiverId, conversation);
        }
        else if (!conversation.IsGroup && !conversation.IsApproved)
        {
            conversation.IsApproved = true;
        }

        // 5️⃣  Lag selve meldingen
        var message = CreateMessage(senderId, conversation.Id, dto, !requiresApproval);
        
        if (conversation.Id == 0)          // samtalen er ny
            message.Conversation = conversation;
        else
            message.ConversationId = conversation.Id;
        
        _context.Messages.Add(message);
        conversation.LastMessageSentAt = message.SentAt;

        // 6️⃣  ÉN lagring av alt ovenfor
        await _context.SaveChangesAsync();

        // 7️⃣  Map DTO (5. query – henter avsender)
        var response = await MapToResponseDto(message);
        
        

        var participantIds = conversation.Participants
            .Select(p => p.UserId)
            .ToArray();
        
        // Rett før køing
        var shouldNotify = !requiresApproval || (messageCount > 0 && !isRejected);
        var isRejectedSender = isRejected && requestSent;
        
        // NotifyAndBroadcastAsync
        if (shouldNotify || needsMessageRequestNotification || isRejectedSender)
        {
            _taskQueue.QueueAsync(() => NotifyAndBroadcastAsync(
                conversationId : conversation.Id,
                isGroup        : conversation.IsGroup,
                groupName      : conversation.GroupName,
                groupImageUrl : conversation.GroupImageUrl,
                participantIds : participantIds,
                senderId       : senderId,
                receiverId     : receiverId,
                response       : response,
                shouldNotify   : shouldNotify,
                needsMessageRequestNotification : needsMessageRequestNotification,
                isRejectedSender: isRejectedSender));
        }
        // 🆕 Marker type så frontend vet hva den skal gjøre
        
        if (isRejected && requestSent)
        {
            response.IsRejectedRequest = true;
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

        if (conversation.Participants.All(p => p.UserId != userId))
            throw new UnauthorizedAccessException("Du har ikke tilgang til denne samtalen.");

        // 👥 GRUPPE: sjekk GroupRequest for brukeren
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
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        return messages.Select(MapToResponseForMessagesToConv).ToList();
    }

    private MessageResponseDTO MapToResponseForMessagesToConv(Message message)
    {
        return new MessageResponseDTO
        {
            Id = message.Id,
            SenderId = message.SenderId,
            Sender = new UserSummaryDTO
            {
                Id = message.Sender.Id,
                FullName = message.Sender.FullName,
                ProfileImageUrl = message.Sender.Profile?.ProfileImageUrl
            },
            Text = message.Text,
            SentAt = message.SentAt,
            ConversationId = message.ConversationId,
            Attachments = message.Attachments
                .Where(a => !string.IsNullOrWhiteSpace(a.FileUrl))
                .Select(a => new AttachmentDto
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList(),
            Reactions = message.Reactions.Select(r => new ReactionDTO
            {
                MessageId = r.MessageId,
                Emoji = r.Emoji,
                UserId = r.UserId
            }).ToList(),
            ParentMessageId = message.ParentMessageId,
            ParentMessageText = message.ParentMessage?.Text
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
            .ToListAsync();

        // ✅ Hent pending gruppe requests
        var groupRequests = await _context.GroupRequests
            .Where(gr => gr.ReceiverId == receiverId && gr.Status == GroupRequestStatus.Pending)
            .Include(gr => gr.Sender).ThenInclude(u => u.Profile)
            .Include(gr => gr.Conversation)
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
            throw new Exception("Samtalen finnes ikke.");

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

        var systemMessage = new SendMessageRequestDTO
        {
            ConversationId = conversationId,
            Text = systemMessageText,
        };

        var sysEntity = CreateMessage(receiverId, conversationId, systemMessage, isApproved: true);
        _context.Messages.Add(sysEntity);

        // ✅ Oppdater LastMessageSentAt
        conversation.LastMessageSentAt = sysEntity.SentAt;

        await _context.SaveChangesAsync();

        // ✅ Lag notifikasjon (bruker senderId fra over)
        var notification = isGroupRequest
            ? await _messageNotificationService.CreateGroupRequestApprovedNotificationAsync(
                receiverId, senderId, conversationId)
            : await _messageNotificationService.CreateMessageRequestApprovedNotificationAsync(
                receiverId, senderId, conversationId);

        // ✅ Send notifikasjon
        var signalREvent = isGroupRequest ? "GroupRequestApproved" : "MessageRequestApproved";
        await _hubContext.Clients.User(senderId.ToString())
            .SendAsync(signalREvent, notification);
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
    public async Task SoftDeleteMessageAsync(int messageId, int userId)
    {
        var message = await _context.Messages.FindAsync(messageId);
        if (message == null)
            throw new KeyNotFoundException("Meldingen finnes ikke.");
    
        if (message.SenderId != userId)
            throw new UnauthorizedAccessException("Du kan bare slette dine egne meldinger.");
    
        message.IsDeleted = true;
        await _context.SaveChangesAsync();
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
                           .FirstOrDefaultAsync(c => c.Id == dto.ConversationId)
                       ?? throw new Exception("Samtalen finnes ikke.");
        
            // ✅ Sjekk at sender er medlem
            if (conv.Participants.All(p => p.UserId != senderId))
                throw new Exception("Du er ikke medlem av denne samtalen.");

            // ✅ For grupper, returner en gyldig receiverId (eller -1 som placeholder)
            if (conv.IsGroup)
            {
                return (conv, null); // Ingen spesifikk receiver for grupper
            }

            // For 1-1 samtaler
            int receiverId = conv.Participants.First(p => p.UserId != senderId).UserId;

            if (senderId == receiverId)
                throw new Exception("Du kan ikke sende en melding til deg selv.");

            return (conv, receiverId);
        }

        // Resten av logikken for nye 1-1 samtaler...
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
        bool isFriend = await _msgCache.IsFriendAsync(senderId, receiverId);

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

    private async Task<MessageResponseDTO> MapToResponseDto(Message message)
    {
        var sender = await _context.Users
            .Where(u => u.Id == message.SenderId)
            .Select(u => new UserSummaryDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null
            })
            .FirstOrDefaultAsync();

        return new MessageResponseDTO
        {
            Id = message.Id,
            SenderId = message.SenderId,
            Sender = sender!,
            Text = message.Text,
            SentAt = message.SentAt,
            ConversationId = message.ConversationId,
            Attachments = message.Attachments?.Select(a => new AttachmentDto
            {
                FileUrl = a.FileUrl,
                FileType = a.FileType,
                FileName = a.FileName
            }).ToList() ?? new List<AttachmentDto>(), 
            Reactions = message.Reactions?.Select(r => new ReactionDTO
            {
                MessageId = r.MessageId,
                Emoji = r.Emoji,
                UserId = r.UserId
            }).ToList() ?? new List<ReactionDTO>(),
            ParentMessageId = message.ParentMessageId,
            ParentMessageText = message.ParentMessage?.Text // valgfritt
        };
    }

    private async Task NotifyAndBroadcastAsync(
    int    conversationId,
    bool   isGroup,
    string? groupName,
    string ? groupImageUrl,
    int[]  participantIds,
    int    senderId,
    int?    receiverId, // 🆕
    MessageResponseDTO response,
    bool   shouldNotify,
    bool   needsMessageRequestNotification,
    bool isRejectedSender) // 🆕
    {
        /* 1. Send over SignalR  */
        if (shouldNotify)               // 👈 legg til
        {
            var signalrTasks = participantIds.Select(async uid =>
            {
                try
                {
                    await _hubContext.Clients.User(uid.ToString())
                        .SendAsync("ReceiveMessage", response);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send message to user {UserId}", uid);
                }
            });

            await Task.WhenAll(signalrTasks);
  
        }
        
        else if (isRejectedSender) // 🆕 Spesialtilfelle
        {
            // Kun SignalR til avsender - ingen notifikasjoner til mottaker
            await _hubContext.Clients.User(senderId.ToString())
                .SendAsync("ReceiveMessage", response);
        }
        
        /* 2. MessageRequest notification hvis nødvendig */
        if (needsMessageRequestNotification)
        {
            using var scope = _scopeFactory.CreateScope();
            var notifSvc = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
            
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

        /* 3. Lag notifications (hvis vi skal) – egen DbContext-scope */
        if (!shouldNotify || isRejectedSender) return;
        
        using var scope2 = _scopeFactory.CreateScope();
        var notifSvc2 = scope2.ServiceProvider.GetRequiredService<MessageNotificationService>();
        
        foreach (var uid in participantIds)
        {
            if (uid == senderId) continue;
            
            await notifSvc2.CreateMessageNotificationAsync(
                recipientUserId : uid,
                senderUserId    : senderId,
                conversationId  : conversationId,
                messageId       : response.Id);
        }
    }

       
}