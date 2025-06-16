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

    public MessageService(ApplicationDbContext context, IHubContext<ChatHub> hubContext,
        MessageNotificationService messageNotificationService, SendMessageCache msgCache,
        IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory)
    {
        _context = context;
        _hubContext = hubContext;
        _messageNotificationService = messageNotificationService;
        _msgCache = msgCache;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;

    }

    // Her sender vi en melding med SendMessageAsync, sender også med vedlegg
    public async Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO dto)
    {
        if (dto.ReceiverId != null && int.TryParse(dto.ReceiverId, out var rid) && rid == senderId) 
            throw new("Du kan ikke sende en melding til deg selv.");
        
        // 1️⃣  Finn eller lag samtalen (1 query, ingen commit hvis den finnes)
        var (conversation, receiverId) = await GetOrCreateConversationFast(senderId, dto);

        // 2️⃣  Blokkeringssjekk  (treffer cache først)
        if (!conversation.IsGroup)                 // 👈 begrens til 1–1
        {
            if (await _msgCache.IsBlockedAsync(receiverId, senderId))
                throw new Exception("Du har ikke tilgang til å sende melding til denne brukeren.");
        }

        // 3️⃣  Må meldingen godkjennes? (3. og evt. 4. query)
        (bool requiresApproval, bool isRejected, bool requestSent) = await ShouldRequireApprovalFast(
            senderId, receiverId, conversation);

        if (!conversation.IsGroup && requiresApproval)
        {
            if (isRejected)
            {
                return new MessageResponseDTO
                {
                    Text = "You have rejected the message request. Accept the message request to start sending messages.",
                    ConversationId = conversation.Id,
                    SenderId = senderId
                };
            }

            if (requestSent)
            {
                return new MessageResponseDTO
                {
                    Text = "Your message request is waiting approval.",
                    ConversationId = conversation.Id,
                    SenderId = senderId
                };
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
                return new MessageResponseDTO
                {
                    Text = "Du har nådd maksgrensen på 5 meldinger før forespørselen godkjennes.",
                    ConversationId = conversation.Id,
                    SenderId = senderId
                };
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
        var shouldNotify = !requiresApproval || messageCount > 0;
        
        // NotifyAndBroadcastAsync
        if (shouldNotify || needsMessageRequestNotification)
        {
            _taskQueue.QueueAsync(() => NotifyAndBroadcastAsync(
                conversationId : conversation.Id,
                isGroup        : conversation.IsGroup,
                groupName      : conversation.GroupName,
                participantIds : participantIds,
                senderId       : senderId,
                receiverId     : receiverId,
                response       : response,
                shouldNotify   : shouldNotify,
                needsMessageRequestNotification : needsMessageRequestNotification));
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

        // 👥 GRUPPE: sjekk MessageRequest for brukeren
        if (conversation.IsGroup && !conversation.IsApproved)
        {
            var hasApproved = await _context.MessageRequests.AnyAsync(r =>
                r.ReceiverId == userId &&
                r.ConversationId == conversationId &&
                r.IsAccepted);

            if (!hasApproved)
                return new List<MessageResponseDTO>(); // Ikke vis meldinger
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
                var ownMessages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId && m.SenderId == userId)
                    .OrderByDescending(m => m.SentAt)
                    .Skip(skip)
                    .Take(take)
                    .Include(m => m.Attachments)
                    .Include(m => m.Reactions)
                    .Include(m => m.Sender).ThenInclude(u => u.Profile)
                    .Include(m => m.ParentMessage)
                    .ToListAsync();

                var otherMessages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId && m.SenderId == otherUserId)
                    .OrderByDescending(m => m.SentAt)
                    .Take(5)
                    .Include(m => m.Attachments)
                    .Include(m => m.Reactions)
                    .Include(m => m.Sender).ThenInclude(u => u.Profile)
                    .Include(m => m.ParentMessage)
                    .ToListAsync();

                var previewMessages = ownMessages
                    .Concat(otherMessages)
                    .OrderBy(m => m.SentAt)
                    .ToList();

                return previewMessages.Select(MapToResponseForMessagesToConv).ToList();
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
        var requests = await _context.MessageRequests
            .Where(r => r.ReceiverId == receiverId && !r.IsAccepted && !r.IsRejected)
            .Include(r => r.Sender).ThenInclude(u => u.Profile)
            .Include(r => r.Conversation)
            .ToListAsync();

        return requests.Select(r => new MessageRequestDTO
        {
            SenderId = r.SenderId,
            SenderName = r.Sender.FullName,
            ProfileImageUrl = r.Sender.Profile?.ProfileImageUrl,
            RequestedAt = r.RequestedAt,
            ConversationId = r.ConversationId,
            GroupName = r.Conversation?.GroupName,
            IsGroup = r.Conversation?.IsGroup ?? false,
            LimitReached = r.LimitReached,
            IsPendingApproval = r.Conversation?.IsApproved == false
        }).ToList();
    }


    // Her henter vi og ser meldinger etter vi har godtkjent en meldingsforespørsel
    public async Task ApproveMessageRequestAsync(int receiverId, int senderId)
    {
        var request = await _context.MessageRequests
            .FirstOrDefaultAsync(r => r.ReceiverId == receiverId && r.SenderId == senderId);

        if (request == null)
            throw new Exception("Forespørselen finnes ikke.");

        if (request.IsAccepted)
            throw new Exception("Forespørselen er allerede godkjent.");

        request.IsAccepted = true;
        request.IsRejected = false;

        // 👇 Oppdater samtalen hvis det er én-til-én
        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == request.ConversationId);

        if (conversation != null && !conversation.IsGroup)
        {
            // Hvis begge brukere nå har godkjent (f.eks. begge har sendt), eller du bare vil godkjenne fra én side:
            conversation.IsApproved = true;
        }

        await _context.SaveChangesAsync();

        // Hent brukeren som godkjenner (for navnetekst)
        var approver = await _context.Users
                           .FirstOrDefaultAsync(u => u.Id == receiverId)
                       ?? throw new Exception("Godkjenneren ble ikke funnet.");

        // ✅ Send automatisk melding via eksisterende sendelogikk
        var systemMessage = new SendMessageRequestDTO
        {
            ConversationId = request.ConversationId ??
                             throw new Exception("ConversationId mangler på meldingforespørselen."),
            Text = $"{approver.FullName} has accepted the conversation.",
            ReceiverId = senderId.ToString()
        };

        // Lag entiteten men uten å sende via BroadcastMessageIfApproved
        var sysEntity = CreateMessage(receiverId, request.ConversationId.Value, systemMessage, isApproved: true);
        _context.Messages.Add(sysEntity);

        // 2) Oppdater LastMessageSentAt på samtalen for å skyve den øverst
        conversation!.LastMessageSentAt = sysEntity.SentAt;

        await _context.SaveChangesAsync();


        // 🆕 Lag notifikasjon til avsenderen om at forespørselen ble godkjent
        var notification = await _messageNotificationService.CreateMessageRequestApprovedNotificationAsync(
            receiverId, // godkjenner
            senderId, // mottaker av notification
            request.ConversationId!.Value
        );

        // Send hele notifikasjonen over SignalR
        await _hubContext.Clients.User(senderId.ToString())
            .SendAsync("MessageRequestApproved", notification);
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

        // Valgfritt: begrens søk i private samtaler hvis ikke godkjent
        if (!conversation.IsGroup && !conversation.IsApproved)
        {
            // Samme begrensningslogikk som du har i get-metoden
            throw new Exception("Du må godkjenne samtalen før du kan søke i meldinger.");
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
    
    // // Askeptere gruppeinvitasjoner
    // public async Task AcceptGroupInviteAsync(int userId, int conversationId)
    // {
    //     var invite = await _context.GroupInviteRequests
    //         .FirstOrDefaultAsync(i => i.InvitedUserId == userId && i.ConversationId == conversationId && !i.IsAccepted);
    //
    //     if (invite == null)
    //         throw new Exception("Ingen gyldig invitasjon funnet.");
    //
    //     invite.IsAccepted = true;
    //
    //     var alreadyParticipant = await _context.ConversationParticipants
    //         .AnyAsync(p => p.ConversationId == conversationId && p.UserId == userId);
    //
    //     if (!alreadyParticipant)
    //     {
    //         _context.ConversationParticipants.Add(new ConversationParticipant
    //         {
    //             ConversationId = conversationId,
    //             UserId = userId
    //         });
    //     }
    //
    //     await _context.SaveChangesAsync();
    //
    //     // 🔄 Send systemmelding via eksisterende logikk
    //     var user = await _context.Users
    //         .Include(u => u.Profile)
    //         .FirstOrDefaultAsync(u => u.Id == userId);
    //
    //     if (user != null)
    //     {
    //         var systemMessage = $"{user.FullName} joined the group.";
    //
    //         await SendMessageAsync(invite.InviterId, new SendMessageRequestDTO
    //         {
    //             ConversationId = conversationId,
    //             Text = systemMessage,
    //             Attachments = null
    //         });
    //     }
    // }
    //
    // // Avslå en gruppeinvitasjon
    // public async Task DeclineGroupInviteAsync(int userId, int conversationId)
    // {
    //     var invite = await _context.GroupInviteRequests
    //         .FirstOrDefaultAsync(r => r.InvitedUserId == userId && r.ConversationId == conversationId && !r.IsAccepted);
    //
    //     if (invite == null)
    //         throw new Exception("Ingen gruppeinvitasjon funnet.");
    //
    //     _context.GroupInviteRequests.Remove(invite);
    //
    //     // ✅ Blokker fremtidige invitasjoner fra denne gruppen
    //     var alreadyBlocked = await _context.GroupBlocks
    //         .AnyAsync(b => b.UserId == userId && b.ConversationId == conversationId);
    //
    //     if (!alreadyBlocked)
    //     {
    //         _context.GroupBlocks.Add(new GroupBlock
    //         {
    //             UserId = userId,
    //             ConversationId = conversationId
    //         });
    //     }
    //
    //     await _context.SaveChangesAsync();
    // }
    //
    // // Unblokke en bruker
    // public async Task<bool> UnblockUserAsync(int blockerId, int blockedUserId)
    // {
    //     var block = await _context.MessageBlocks
    //         .FirstOrDefaultAsync(b => b.BlockerId == blockerId && b.BlockedUserId == blockedUserId);
    //
    //     if (block == null)
    //         return false;
    //
    //     _context.MessageBlocks.Remove(block);
    //     await _context.SaveChangesAsync();
    //     return true;
    // }
    //
    // // Henter alle blokkerte brukere
    // public async Task<List<BlockedUserDTO>> GetBlockedUsersAsync(int userId)
    // {
    //     var blocked = await _context.MessageBlocks
    //         .Where(b => b.BlockerId == userId)
    //         .Include(b => b.BlockedUser)
    //         .ThenInclude(u => u.Profile)
    //         .Select(b => new BlockedUserDTO
    //         {
    //             Id = b.BlockedUser.Id,
    //             FullName = b.BlockedUser.FullName,
    //             ProfileImageUrl = b.BlockedUser.Profile != null ? b.BlockedUser.Profile.ProfileImageUrl : null,
    //             BlockedAt = b.BlockedAt
    //         })
    //         .ToListAsync();
    //
    //     return blocked;
    // }
    //
    // // Blokkere en bruker
    // public async Task<bool> BlockUserAsync(int blockerId, int blockedUserId)
    // {
    //     if (blockerId == blockedUserId)
    //         throw new InvalidOperationException("Du kan ikke blokkere deg selv.");
    //
    //     var alreadyBlocked = await _context.MessageBlocks
    //         .AnyAsync(b => b.BlockerId == blockerId && b.BlockedUserId == blockedUserId);
    //
    //     if (alreadyBlocked)
    //         return false;
    //
    //     _context.MessageBlocks.Add(new MessageBlock
    //     {
    //         BlockerId = blockerId,
    //         BlockedUserId = blockedUserId
    //     });
    //
    //     await _context.SaveChangesAsync();
    //     return true;
    // }
    //
    // // Henter alle blokkerte grupper til en bruker
    // public async Task<List<BlockedGroupDTO>> GetBlockedGroupsAsync(int userId)
    // {
    //     var blocked = await _context.GroupBlocks
    //         .Where(b => b.UserId == userId)
    //         .Include(b => b.Conversation)
    //         .ToListAsync();
    //
    //     return blocked.Select(b => new BlockedGroupDTO
    //     {
    //         ConversationId = b.ConversationId,
    //         GroupName = b.Conversation.GroupName ?? "(Ukjent gruppe)",
    //         BlockedAt = b.BlockedAt
    //     }).ToList();
    // }
    //
    // // Unblokker en gruppe
    // public async Task UnblockGroupAsync(int userId, int conversationId)
    // {
    //     var block = await _context.GroupBlocks
    //         .FirstOrDefaultAsync(b => b.UserId == userId && b.ConversationId == conversationId);
    //
    //     if (block == null)
    //         throw new Exception("Blokkeringen ble ikke funnet.");
    //
    //     _context.GroupBlocks.Remove(block);
    //     await _context.SaveChangesAsync();
    // }
    //
    



    
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
    private async Task<(Conversation conv, int receiverId)> GetOrCreateConversationFast(
        int senderId, SendMessageRequestDTO dto)
    {
        if (dto.ConversationId > 0)
        {
            var conv = await _context.Conversations
                           .Include(c => c.Participants)
                           .FirstOrDefaultAsync(c => c.Id == dto.ConversationId)
                       ?? throw new Exception("Samtalen finnes ikke.");
            
            if (conv.Participants.All(p => p.UserId != senderId))
                throw new Exception("Du er ikke medlem av denne samtalen.");

            int receiverId = conv.Participants.First(p => p.UserId != senderId).UserId;

            // 🆕 Valider bruker selv for eksisterende samtaler
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
            bool hasApproved = await _context.MessageRequests.AsNoTracking()
                .AnyAsync(r => r.ConversationId == conv.Id &&
                               r.ReceiverId == senderId &&
                               r.IsAccepted);
            return (!hasApproved, false, false);
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


        bool isRejected = req?.SenderId == senderId && req.IsRejected;
        bool requestSent = req?.SenderId == senderId;

        return (true, isRejected, requestSent);
    }

    // 5. Legg bare til en entity – ingen SaveChanges her
    private bool AddMessageRequestEntityIfMissing(int senderId, int receiverId, Conversation conv)
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
            ReceiverId = receiverId,
            Conversation = conv
        });

        return true; // 🆕 Ny request opprettet
    }

    // 6. Limit-reached markeres, men vi committer senere
    private void MarkLimitReached(int senderId, int receiverId, int convId)
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
    int[]  participantIds,
    int    senderId,
    int    receiverId, // 🆕
    MessageResponseDTO response,
    bool   shouldNotify,
    bool   needsMessageRequestNotification) // 🆕
    {
        /* 1. Send over SignalR  */
        if (shouldNotify)               // 👈 legg til
        {
            if (!isGroup)
            {
                foreach (var uid in participantIds)
                {
                    await _hubContext.Clients.User(uid.ToString())
                        .SendAsync("ReceiveMessage", response);
                }
            }
            else if (!string.IsNullOrEmpty(groupName))
            {
                await _hubContext.Clients.Group(groupName)
                    .SendAsync("ReceiveMessage", response);
            }
        }
        
        /* 2. MessageRequest notification hvis nødvendig */
        if (needsMessageRequestNotification)
        {
            using var scope = _scopeFactory.CreateScope();
            var notifSvc = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
            
            var notification = await notifSvc.CreateMessageRequestNotificationAsync(
                senderId, receiverId, conversationId);

            // Send SignalR for MessageRequest
            if (notification != null && notification.Type == NotificationType.MessageRequest)
            {
                await _hubContext.Clients.User(receiverId.ToString()).SendAsync("MessageRequestCreated", new MessageRequestCreatedDto
                {
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    ConversationId = conversationId,
                    Notification = notification
                });
            }
        }

        /* 3. Lag notifications (hvis vi skal) – egen DbContext-scope */
        if (!shouldNotify) return;
        
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