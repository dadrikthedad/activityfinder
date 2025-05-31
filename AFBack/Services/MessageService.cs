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

        public MessageService(ApplicationDbContext context, IHubContext<ChatHub> hubContext, MessageNotificationService messageNotificationService)
        {
            _context = context;
            _hubContext = hubContext;
            _messageNotificationService = messageNotificationService;
            
        }
        // Her sender vi en melding med SendMessageAsync, sender også med vedlegg
        public async Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO request)
        {       
            Conversation conversation;
            bool isApproved = true;
            int? receiverId = null;

            // 🎯 Hent eller opprett samtale
            if (request.ConversationId <= 0)
            {
                if (!int.TryParse(request.ReceiverId, out var parsedReceiverId))
                    throw new Exception("Ugyldig mottaker-ID.");

                receiverId = parsedReceiverId;

                await CheckUserValidity(senderId, receiverId.Value);

                if (await IsUserBlocked(senderId, receiverId.Value))
                    throw new Exception("Du har ikke tilgang til å sende melding til denne brukeren.");

                conversation = await GetOrCreateConversation(senderId, receiverId.Value);
            }
            else
            {
                conversation = await _context.Conversations
                    .Include(c => c.Participants)
                    .FirstOrDefaultAsync(c => c.Id == request.ConversationId)
                    ?? throw new Exception("Samtalen finnes ikke.");

                receiverId = conversation.Participants
                    .FirstOrDefault(p => p.UserId != senderId)?.UserId;
            }

            // 🔒 Sjekk om meldingen krever godkjenning (for både nye og eksisterende samtaler)
            if (receiverId != null && await ShouldRequireApproval(senderId, receiverId.Value, conversation.Id))
            {
                await AddMessageRequestIfNotExists(senderId, receiverId.Value, conversation.Id);
                isApproved = false;

                var messageCount = await _context.Messages
                    .CountAsync(m => m.ConversationId == conversation.Id && m.SenderId == senderId);

                if (messageCount >= 5)
                {
                    var messageRequest = await _context.MessageRequests
                        .FirstOrDefaultAsync(r =>
                            (r.SenderId == senderId && r.ReceiverId == receiverId) ||
                            (r.SenderId == receiverId && r.ReceiverId == senderId));

                    if (messageRequest != null)
                    {
                        messageRequest.LimitReached = true;
                        await _context.SaveChangesAsync();
                    }

                    return new MessageResponseDTO
                    {
                        Text = "Du har nådd maksgrensen på 5 meldinger før forespørselen besgodkjennes.",
                        ConversationId = conversation.Id,
                        SenderId = senderId
                    };
                }
            }

            // ✉️ Lagre meldingen
            var message = CreateMessage(senderId, conversation.Id, request, isApproved);
            _context.Messages.Add(message);

            // 🔄 Oppdater LastMessageSentAt
            conversation.LastMessageSentAt = message.SentAt;

            await _context.SaveChangesAsync();

            var response = await MapToResponseDto(message);
            
            await BroadcastMessageIfApproved(conversation, senderId, response);
            
            foreach (var participant in conversation.Participants)
            {
                if (participant.UserId != senderId)
                {
                    await _messageNotificationService.CreateMessageNotificationAsync(
                        recipientUserId: participant.UserId,
                        senderUserId: senderId,
                        conversationId: conversation.Id,
                        messageId: message.Id
                    );
                }
            }
            
            return response;
        }

        // Her henter vi meldinger etter ConversationId
        public async Task<List<MessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int userId, int skip = 0, int take = 20)
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
                .Where(r => r.ReceiverId == receiverId && !r.IsAccepted)
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
            
            var approver = await _context.Users
                               .FirstOrDefaultAsync(u => u.Id == receiverId)
                           ?? throw new Exception("Godkjenneren ble ikke funnet.");
            
            // ✅ Send automatisk melding via eksisterende sendelogikk
            var systemMessage = new SendMessageRequestDTO
            {
                ConversationId = request.ConversationId ?? throw new Exception("ConversationId mangler på meldingforespørselen."),
                Text = $"{approver.FullName} has accepted the conversation.",
                ReceiverId = senderId.ToString()
            };

            await SendMessageAsync(receiverId, systemMessage); // godkjenneren som avsender
            
            // 🆕 Lag notifikasjon til avsenderen om at forespørselen ble godkjent
            var notification = await _messageNotificationService.CreateMessageRequestApprovedNotificationAsync(
                receiverId, // godkjenner
                senderId,   // mottaker av notification
                request.ConversationId!.Value
            );

            // Send hele notifikasjonen over SignalR
            await _hubContext.Clients.User(senderId.ToString())
                .SendAsync("MessageRequestApproved", notification);
        }
        
        // Søke etter meldinger til en samtale
        public async Task<List<MessageResponseDTO>> SearchMessagesInConversationAsync(int conversationId, int userId, string query, int skip = 0, int take = 50)
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
        
        
        // Avslår meldinger fra en bruker og sletter forespørsel samt blokkerer sender fra å sende flere meldinger
        public async Task DeclineMessageRequestAsync(int receiverId, int senderId)
        {
            // 1. Finn forespørselen
            var request = await _context.MessageRequests
                .FirstOrDefaultAsync(r => r.SenderId == senderId && r.ReceiverId == receiverId);

            if (request == null)
                throw new Exception("Ingen meldingsforespørsel funnet.");

            // 2. Slett forespørselen
            _context.MessageRequests.Remove(request);

            // 3. Blokker senderen fra å sende flere meldinger
            var alreadyBlocked = await _context.MessageBlocks
                .AnyAsync(b => b.BlockerId == receiverId && b.BlockedUserId == senderId);

            if (!alreadyBlocked)
            {
                _context.MessageBlocks.Add(new MessageBlock
                {
                    BlockerId = receiverId,
                    BlockedUserId = senderId,
                    BlockedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
        }
        // Askeptere gruppeinvitasjoner
        public async Task AcceptGroupInviteAsync(int userId, int conversationId)
        {
            var invite = await _context.GroupInviteRequests
                .FirstOrDefaultAsync(i => i.InvitedUserId == userId && i.ConversationId == conversationId && !i.IsAccepted);

            if (invite == null)
                throw new Exception("Ingen gyldig invitasjon funnet.");

            invite.IsAccepted = true;

            var alreadyParticipant = await _context.ConversationParticipants
                .AnyAsync(p => p.ConversationId == conversationId && p.UserId == userId);

            if (!alreadyParticipant)
            {
                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversationId,
                    UserId = userId
                });
            }

            await _context.SaveChangesAsync();

            // 🔄 Send systemmelding via eksisterende logikk
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user != null)
            {
                var systemMessage = $"{user.FullName} joined the group.";

                await SendMessageAsync(invite.InviterId, new SendMessageRequestDTO
                {
                    ConversationId = conversationId,
                    Text = systemMessage,
                    Attachments = null
                });
            }
        }
        
        // Avslå en gruppeinvitasjon
        public async Task DeclineGroupInviteAsync(int userId, int conversationId)
        {
            var invite = await _context.GroupInviteRequests
                .FirstOrDefaultAsync(r => r.InvitedUserId == userId && r.ConversationId == conversationId && !r.IsAccepted);

            if (invite == null)
                throw new Exception("Ingen gruppeinvitasjon funnet.");

            _context.GroupInviteRequests.Remove(invite);

            // ✅ Blokker fremtidige invitasjoner fra denne gruppen
            var alreadyBlocked = await _context.GroupBlocks
                .AnyAsync(b => b.UserId == userId && b.ConversationId == conversationId);

            if (!alreadyBlocked)
            {
                _context.GroupBlocks.Add(new GroupBlock
                {
                    UserId = userId,
                    ConversationId = conversationId
                });
            }

            await _context.SaveChangesAsync();
        }
        
        // Unblokke en bruker
        public async Task<bool> UnblockUserAsync(int blockerId, int blockedUserId)
        {
            var block = await _context.MessageBlocks
                .FirstOrDefaultAsync(b => b.BlockerId == blockerId && b.BlockedUserId == blockedUserId);

            if (block == null)
                return false;

            _context.MessageBlocks.Remove(block);
            await _context.SaveChangesAsync();
            return true;
        }
        
        // Henter alle blokkerte brukere
        public async Task<List<BlockedUserDTO>> GetBlockedUsersAsync(int userId)
        {
            var blocked = await _context.MessageBlocks
                .Where(b => b.BlockerId == userId)
                .Include(b => b.BlockedUser)
                .ThenInclude(u => u.Profile)
                .Select(b => new BlockedUserDTO
                {
                    Id = b.BlockedUser.Id,
                    FullName = b.BlockedUser.FullName,
                    ProfileImageUrl = b.BlockedUser.Profile != null ? b.BlockedUser.Profile.ProfileImageUrl : null,
                    BlockedAt = b.BlockedAt
                })
                .ToListAsync();

            return blocked;
        }
        // Blokkere en bruker
        public async Task<bool> BlockUserAsync(int blockerId, int blockedUserId)
        {
            if (blockerId == blockedUserId)
                throw new InvalidOperationException("Du kan ikke blokkere deg selv.");

            var alreadyBlocked = await _context.MessageBlocks
                .AnyAsync(b => b.BlockerId == blockerId && b.BlockedUserId == blockedUserId);

            if (alreadyBlocked)
                return false;

            _context.MessageBlocks.Add(new MessageBlock
            {
                BlockerId = blockerId,
                BlockedUserId = blockedUserId
            });

            await _context.SaveChangesAsync();
            return true;
        }
        // Henter alle blokkerte grupper til en bruker
        public async Task<List<BlockedGroupDTO>> GetBlockedGroupsAsync(int userId)
        {
            var blocked = await _context.GroupBlocks
                .Where(b => b.UserId == userId)
                .Include(b => b.Conversation)
                .ToListAsync();

            return blocked.Select(b => new BlockedGroupDTO
            {
                ConversationId = b.ConversationId,
                GroupName = b.Conversation.GroupName ?? "(Ukjent gruppe)",
                BlockedAt = b.BlockedAt
            }).ToList();
        }
        // Unblokker en gruppe
        public async Task UnblockGroupAsync(int userId, int conversationId)
        {
            var block = await _context.GroupBlocks
                .FirstOrDefaultAsync(b => b.UserId == userId && b.ConversationId == conversationId);

            if (block == null)
                throw new Exception("Blokkeringen ble ikke funnet.");

            _context.GroupBlocks.Remove(block);
            await _context.SaveChangesAsync();
        }
        
        
        
        
        
        // Hjelpemetoder til SendMessage
        public async Task CheckUserValidity(int senderId, int receiverId)
        {
            if (senderId == receiverId)
                throw new Exception("Du kan ikke sende en melding til deg selv.");

            var senderExists = await _context.Users.AnyAsync(u => u.Id == senderId);
            if (!senderExists)
                throw new Exception("Sender-brukeren finnes ikke.");

            var receiverExists = await _context.Users.AnyAsync(u => u.Id == receiverId);
            if (!receiverExists)
                throw new Exception("Mottaker-brukeren finnes ikke.");
        }
        
        public async Task<bool> IsUserBlocked(int senderId, int receiverId)
        {
            return await _context.MessageBlocks
                .AnyAsync(b => b.BlockerId == receiverId && b.BlockedUserId == senderId);
        }
        
        public async Task<Conversation> GetOrCreateConversation(int senderId, int receiverId)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c =>
                    !c.IsGroup &&
                    c.Participants.Count == 2 &&
                    c.Participants.Any(p => p.UserId == senderId) &&
                    c.Participants.Any(p => p.UserId == receiverId));

            if (conversation == null)
            {
                conversation = new Conversation
                {
                    IsGroup = false,
                    CreatorId = senderId,
                    Participants = new List<ConversationParticipant>
                    {
                        new ConversationParticipant { UserId = senderId },
                        new ConversationParticipant { UserId = receiverId }
                    }
                };

                _context.Conversations.Add(conversation);
                await _context.SaveChangesAsync();
            }

            return conversation;
        }
        
        public async Task<bool> ShouldRequireApproval(int senderId, int receiverId, int? conversationId = null)
        {
            // Hvis det er en samtale og det er en gruppe
            if (conversationId.HasValue)
            {
                var conversation = await _context.Conversations
                    .FirstOrDefaultAsync(c => c.Id == conversationId.Value);

                if (conversation != null && conversation.IsGroup)
                {
                    // I grupper: kreves godkjenning per bruker via MessageRequest
                    var hasUserApproved = await _context.MessageRequests.AnyAsync(r =>
                        r.ConversationId == conversation.Id &&
                        r.ReceiverId == senderId && // Viktig: denne brukeren må ha godkjent selv
                        r.IsAccepted);

                    return !hasUserApproved; // Hvis du ikke har godkjent, krever vi godkjenning
                }

                if (conversation != null && conversation.IsApproved)
                    return false;
            }

            // Én-til-én-sjekk som før
            var isFriend = await _context.Friends.AnyAsync(f =>
                (f.UserId == senderId && f.FriendId == receiverId) ||
                (f.UserId == receiverId && f.FriendId == senderId));

            var isMessageApproved = await _context.MessageRequests.AnyAsync(r =>
                r.IsAccepted &&
                (
                    (r.SenderId == senderId && r.ReceiverId == receiverId) ||
                    (r.SenderId == receiverId && r.ReceiverId == senderId)
                ));

            return !(isFriend || isMessageApproved);
        }
        
       public async Task AddMessageRequestIfNotExists(int senderId, int receiverId, int conversationId)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conversation == null)
                throw new Exception("Samtalen finnes ikke.");

            // TODO: For gruppesamtaler må vi senere sende en forespørsel til hver deltaker (utenom avsender)
            if (conversation.IsGroup)
            {
                if (receiverId == senderId)
                    return;

                var existing = await _context.MessageRequests.FirstOrDefaultAsync(r =>
                    r.ConversationId == conversation.Id &&
                    r.ReceiverId == receiverId &&
                    r.SenderId == senderId);

                if (existing == null)
                {
                    _context.MessageRequests.Add(new MessageRequest
                    {
                        SenderId = senderId,
                        ReceiverId = receiverId,
                        ConversationId = conversation.Id
                    });

                    await _messageNotificationService.CreateMessageRequestNotificationAsync(
                        senderId, receiverId, conversation.Id);

                    await _context.SaveChangesAsync();

                    await _hubContext.Clients.User(receiverId.ToString()).SendAsync("MessageRequestCreated", new MessageRequestCreatedDto
                    {
                        SenderId = senderId,
                        ReceiverId = receiverId,
                        ConversationId = conversation.Id
                    });
                }

                return;
            }

            // Én-til-én samtale
            var existingRequest = await _context.MessageRequests
                .FirstOrDefaultAsync(r =>
                    r.ConversationId == conversation.Id &&
                    (
                        (r.SenderId == senderId && r.ReceiverId == receiverId) ||
                        (r.SenderId == receiverId && r.ReceiverId == senderId)
                    )
                );

            if (existingRequest == null)
            {
                _context.MessageRequests.Add(new MessageRequest
                {
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    ConversationId = conversation.Id
                });

                // 👇 Lag notification og legg den til
                var notification = await _messageNotificationService.CreateMessageRequestNotificationAsync(
                    senderId, receiverId, conversation.Id);

                await _context.SaveChangesAsync();

                if (notification != null)
                {
                    await _hubContext.Clients.User(receiverId.ToString()).SendAsync("MessageRequestCreated", new {
                        senderId,
                        receiverId,
                        conversationId = conversation.Id,
                        notification
                    });
                }
            }
        }

        
        public Message CreateMessage(int senderId, int conversationId, SendMessageRequestDTO request, bool isApproved)
        {
            return new Message
            {
                SenderId = senderId,
                ConversationId = conversationId,
                Text = request.Text,
                SentAt = DateTime.UtcNow,
                ParentMessageId = request.ParentMessageId > 0 ? request.ParentMessageId : null,
                Attachments = request.Attachments?.Select(a => new MessageAttachment
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList() ?? new List<MessageAttachment>()
            };
        }
        
        public async Task BroadcastMessageIfApproved(Conversation conversation, int senderId, MessageResponseDTO response)
        {
            if (!conversation.IsGroup)
            {
                foreach (var participant in conversation.Participants)
                {
                        await _hubContext.Clients.User(participant.UserId.ToString())
                            .SendAsync("ReceiveMessage", response);
                }
            }
            else if (!string.IsNullOrEmpty(conversation.GroupName))
            {
                await _hubContext.Clients.Group(conversation.GroupName)
                    .SendAsync("ReceiveMessage", response);
            }
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
                Attachments = message.Attachments.Select(a => new AttachmentDto
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
                ParentMessageText = message.ParentMessage?.Text // valgfritt
            };
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

}