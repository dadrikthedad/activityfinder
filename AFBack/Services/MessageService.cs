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
                }

                if (!isApproved)
                {
                    return new MessageResponseDTO
                    {
                        Text = "Meldingen er sendt som forespørsel og vil bli synlig etter godkjenning.",
                        ConversationId = conversation.Id,
                        SenderId = senderId
                    };
                }
            }
            else
            {
                conversation = await _context.Conversations
                                   .Include(c => c.Participants)
                                   .FirstOrDefaultAsync(c => c.Id == request.ConversationId)
                               ?? throw new Exception("Samtalen finnes ikke.");
            }

            // 🔽 Felles for begge grener
            var message = CreateMessage(senderId, conversation.Id, request, isApproved);
            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var response = MapToResponseDto(message);
            await BroadcastMessageIfApproved(conversation, senderId, response);

            return response;
        }

        // Her henter vi meldinger etter ConversationId
        public async Task<List<MessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int skip = 0, int take = 20)
        {
            var messages = await _context.Messages
                .Where(m => m.ConversationId == conversationId)
                .OrderByDescending(m => m.SentAt)
                .Skip(skip)
                .Take(take)
                .Include(m => m.Attachments)
                .ToListAsync();

            return messages.Select(m => new MessageResponseDTO
            {
                Id = m.Id,
                SenderId = m.SenderId,
                Text = m.Text,
                SentAt = m.SentAt,
                ConversationId = m.ConversationId,
                Attachments = m.Attachments.Select(a => new AttachmentDto
                {
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileName = a.FileName
                }).ToList()
            }).ToList();
        }
        
        // Hente alle meldingsforespørsler til en bruker
        public async Task<List<MessageRequestDTO>> GetPendingMessageRequestsAsync(int receiverId)
        {
            var requests = await _context.MessageRequests
                .Where(r => r.ReceiverId == receiverId && !r.IsAccepted)
                .Include(r => r.Sender)
                .ThenInclude(u => u.Profile)
                .ToListAsync();

            return requests.Select(r => new MessageRequestDTO
            {
                SenderId = r.SenderId,
                SenderName = r.Sender.FullName,
                ProfileImageUrl = r.Sender.Profile != null ? r.Sender.Profile.ProfileImageUrl : null,
                RequestedAt = r.RequestedAt
            }).ToList();
        }
        // Henter alle gruppemeldingsforespørsler til en bruker
        public async Task<List<GroupInviteRequestDTO>> GetPendingGroupInvitesAsync(int userId)
        {
            var invites = await _context.GroupInviteRequests
                .Where(r => r.InvitedUserId == userId && !r.IsAccepted)
                .Include(r => r.Inviter)
                .Include(r => r.Conversation)
                .ToListAsync();

            return invites.Select(r => new GroupInviteRequestDTO
            {
                ConversationId = r.ConversationId,
                GroupName = r.Conversation.GroupName,
                InviterId = r.InviterId,
                InviterName = r.Inviter.FullName,
                RequestedAt = r.RequestedAt
            }).ToList();

        }
        // Henter alle meldingingsforespørsler til en bruker
        public async Task<AllPendingRequestsDTO> GetAllPendingRequestsAsync(int userId)
        {
            var messageRequests = await GetPendingMessageRequestsAsync(userId);
            var groupRequests = await _context.GroupInviteRequests
                .Where(r => r.InvitedUserId == userId && !r.IsAccepted)
                .Include(r => r.Inviter).ThenInclude(u => u.Profile)
                .Include(r => r.Conversation)
                .Select(r => new GroupInviteRequestDTO
                {
                    ConversationId = r.ConversationId,
                    GroupName = r.Conversation.GroupName ?? "Ukjent gruppe",
                    InviterId = r.InviterId,
                    InviterName = r.Inviter.FullName,
                    InviterProfileImageUrl = r.Inviter.Profile != null ? r.Inviter.Profile.ProfileImageUrl : null,
                    RequestedAt = r.RequestedAt
                })
                .ToListAsync();

            return new AllPendingRequestsDTO
            {
                MessageRequests = messageRequests,
                GroupInvites = groupRequests
            };
        }


        // Her henter vi og ser meldinger etter vi har godtkjent en meldingsforespørsel
        public async Task ApproveMessageRequestAsync(int receiverId, int senderId)
        {
            // 1. Finn og oppdater meldingsforespørsel
            var request = await _context.MessageRequests
                .FirstOrDefaultAsync(r => r.SenderId == senderId && r.ReceiverId == receiverId);

            if (request == null)
                throw new Exception("Ingen meldingsforespørsel funnet.");

            request.IsAccepted = true;

            // 2. Finn alle meldinger som ikke var godkjent, og godkjenn dem
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .Include(c => c.Messages).ThenInclude(message => message.Attachments)
                .FirstOrDefaultAsync(c =>
                    !c.IsGroup &&
                    c.Participants.Any(p => p.UserId == senderId) &&
                    c.Participants.Any(p => p.UserId == receiverId));

            if (conversation != null)
            {
                var user = await _context.Users.FindAsync(receiverId);
                if (user != null)
                {
                    var systemMessage = $"{user.FullName} accepted the message request.";
        
                    await SendMessageAsync(receiverId, new SendMessageRequestDTO
                    {
                        ConversationId = conversation.Id,
                        Text = systemMessage,
                        Attachments = null
                    });
                }
            }

            await _context.SaveChangesAsync();
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
            return !await _context.Friends.AnyAsync(f =>
                (f.UserId == senderId && f.FriendId == receiverId) ||
                (f.UserId == receiverId && f.FriendId == senderId));
        }
        
        public async Task AddMessageRequestIfNotExists(int senderId, int receiverId)
        {
            var exists = await _context.MessageRequests
                .AnyAsync(r => r.SenderId == senderId && r.ReceiverId == receiverId);

            if (!exists)
            {
                _context.MessageRequests.Add(new MessageRequest
                {
                    SenderId = senderId,
                    ReceiverId = receiverId
                });

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
                IsApproved = isApproved,
                ParentMessageId = request.ParentMessageId, // 👈 Her
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
                    if (participant.UserId != senderId)
                    {
                        await _hubContext.Clients.User(participant.UserId.ToString())
                            .SendAsync("ReceiveMessage", response);
                    }
                }
            }
            else if (!string.IsNullOrEmpty(conversation.GroupName))
            {
                await _hubContext.Clients.Group(conversation.GroupName)
                    .SendAsync("ReceiveMessage", response);
            }
        }
        
        private MessageResponseDTO MapToResponseDto(Message message)
        {
            return new MessageResponseDTO
            {
                Id = message.Id,
                SenderId = message.SenderId,
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