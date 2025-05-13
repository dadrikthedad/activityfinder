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

        public MessageService(ApplicationDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }
        // Her sender vi en melding med SendMessageAsync, sender også med vedlegg
        public async Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO request)
        {       
            Conversation conversation;
            bool isApproved = true;

            if (request.ConversationId <= 0)
            {
                if (!int.TryParse(request.ReceiverId, out var receiverId))
                    throw new Exception("Ugyldig mottaker-ID.");

                await CheckUserValidity(senderId, receiverId);

                if (await IsUserBlocked(senderId, receiverId))
                    throw new Exception("Du har ikke tilgang til å sende melding til denne brukeren.");

                conversation = await GetOrCreateConversation(senderId, receiverId);

                if (await ShouldRequireApproval(senderId, receiverId))
                {
                    await AddMessageRequestIfNotExists(senderId, receiverId);
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
            }
            else
            {
                conversation = await _context.Conversations
                    .Include(c => c.Participants)
                    .FirstOrDefaultAsync(c => c.Id == request.ConversationId)
                    ?? throw new Exception("Samtalen finnes ikke.");
            }

            var message = CreateMessage(senderId, conversation.Id, request, isApproved);
            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var response = await MapToResponseDto(message);

            if (isApproved)
            {
                await BroadcastMessageIfApproved(conversation, senderId, response);
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

            // 👥 GRUPPELOGIKK
            if (conversation.IsGroup)
            {
                var isGroupApproved = await _context.MessageRequests.AnyAsync(r =>
                    r.ReceiverId == userId &&
                    r.ConversationId == conversationId &&
                    r.IsAccepted);

                if (!isGroupApproved)
                    return new List<MessageResponseDTO>(); // Ikke vis noe før godkjenning
            }
            else
            {
                // 👤 PRIVATLOGIKK
                var otherUserId = conversation.Participants.First(p => p.UserId != userId).UserId;

                var isApproved = await _context.Friends.AnyAsync(f =>
                                     (f.UserId == userId && f.FriendId == otherUserId) ||
                                     (f.FriendId == userId && f.UserId == otherUserId)) ||
                                 await _context.MessageRequests.AnyAsync(r =>
                                     ((r.SenderId == otherUserId && r.ReceiverId == userId) ||
                                      (r.SenderId == userId && r.ReceiverId == otherUserId)) &&
                                     r.IsAccepted);
                
                if (!isApproved)
                {
                    // 👁️ Vis maks 5 meldinger fra den andre brukeren (uansett IsApproved-status)
                    // Egne meldinger (vis alle)
                    var ownMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversationId && m.SenderId == userId)
                        .OrderByDescending(m => m.SentAt)
                        .Skip(skip) // optional
                        .Take(take) // optional
                        .Include(m => m.Attachments)
                        .Include(m => m.Reactions)
                        .Include(m => m.Sender).ThenInclude(u => u.Profile)
                        .ToListAsync();

                    // Meldingene fra motparten (maks 5)
                    var otherMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversationId && m.SenderId == otherUserId)
                        .OrderByDescending(m => m.SentAt)
                        .Take(5)
                        .Include(m => m.Attachments)
                        .Include(m => m.Reactions)
                        .Include(m => m.Sender).ThenInclude(u => u.Profile)
                        .ToListAsync();

                    // Kombiner og sorter alle
                    var previewMessages = ownMessages
                        .Concat(otherMessages)
                        .OrderBy(m => m.SentAt)
                        .ToList();

                    return previewMessages.Select(m => new MessageResponseDTO
                    {
                        Id = m.Id,
                        SenderId = m.SenderId,
                        ConversationId = m.ConversationId,
                        SentAt = m.SentAt,
                        Text = m.Text,
                        Sender = new UserSummaryDTO
                        {
                            Id = m.Sender.Id,
                            FullName = m.Sender.FullName,
                            ProfileImageUrl = m.Sender.Profile?.ProfileImageUrl
                        },
                        Attachments = m.Attachments.Select(a => new AttachmentDto
                        {
                            FileUrl = a.FileUrl,
                            FileType = a.FileType,
                            FileName = a.FileName
                        }).ToList(),
                        Reactions = m.Reactions.Select(r => new ReactionDTO
                        {
                            MessageId = r.MessageId,
                            Emoji = r.Emoji,
                            UserId = r.UserId,
                            IsRemoved = false
                        }).ToList()
                    }).ToList();
                }
            }

            // ✅ Vanlig samtale eller godkjent
            var query = _context.Messages
                .Where(m => m.ConversationId == conversationId)
                .Include(m => m.Attachments)
                .Include(m => m.Reactions)
                .Include(m => m.Sender).ThenInclude(u => u.Profile)
                .OrderByDescending(m => m.SentAt)
                .Skip(skip)
                .Take(take);

            var messages = await query.ToListAsync();

            return messages.Select(m => new MessageResponseDTO
            {
                Id = m.Id,
                SenderId = m.SenderId,
                ConversationId = m.ConversationId,
                SentAt = m.SentAt,
                Text = m.Text,
                Sender = new UserSummaryDTO
                {
                    Id = m.Sender.Id,
                    FullName = m.Sender.FullName,
                    ProfileImageUrl = m.Sender.Profile?.ProfileImageUrl
                },
                Attachments = m.Attachments.Select(a => new AttachmentDto
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList(),
                Reactions = m.Reactions.Select(r => new ReactionDTO
                {
                    MessageId = r.MessageId,
                    Emoji = r.Emoji,
                    UserId = r.UserId,
                    IsRemoved = false
                }).ToList()
            }).ToList();
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
                LimitReached = r.LimitReached
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
            await _context.SaveChangesAsync();
            
            await _hubContext.Clients.User(senderId.ToString())
                .SendAsync("MessageRequestApproved", new {
                    ReceiverId = receiverId,
                    ConversationId = request.ConversationId
                });
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
        
        public async Task<bool> ShouldRequireApproval(int senderId, int receiverId)
        {
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
        
        public async Task AddMessageRequestIfNotExists(int senderId, int receiverId)
        {
            var conversation = await GetOrCreateConversation(senderId, receiverId);

            if (conversation == null)
                throw new Exception("Kunne ikke finne eller opprette en samtale.");

            // Finn eksisterende request i begge retninger
            var existing = await _context.MessageRequests
                .FirstOrDefaultAsync(r =>
                    r.ConversationId == conversation.Id &&
                    (
                        (r.SenderId == senderId && r.ReceiverId == receiverId) ||
                        (r.SenderId == receiverId && r.ReceiverId == senderId)
                    )
                );

            if (existing == null)
            {
                _context.MessageRequests.Add(new MessageRequest
                {
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    ConversationId = conversation.Id
                });

                await _context.SaveChangesAsync();
            }
            else if (existing.ConversationId == null)
            {
                // Ekstra sikkerhet – fyll inn hvis mangler
                existing.ConversationId = conversation.Id;
                await _context.SaveChangesAsync();
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