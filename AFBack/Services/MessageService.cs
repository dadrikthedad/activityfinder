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
            Conversation conversation;  // Holder samtaleobjektet som meldingen skal knyttes til
            bool isApproved = true; // Antar at meldingen er godkjent med mindre vi finner ut noe annet

            if (request.ConversationId <= 0) // Hvis det ikke er en eksisterende samtale (privat melding)
            {
                if (!int.TryParse(request.ReceiverId, out var receiverId))
                    throw new Exception("Ugyldig mottaker-ID."); // Feil hvis mottaker-ID ikke kan tolkes som int

                await CheckUserValidity(senderId, receiverId); // Sjekk at både avsender og mottaker finnes og er gyldige

                if (await IsUserBlocked(senderId, receiverId)) // Sjekk om sender er blokkert
                    throw new Exception("Du har ikke tilgang til å sende melding til denne brukeren.");

                conversation = await GetOrCreateConversation(senderId, receiverId); // Finn eller opprett en privat samtale mellom de to brukerne

                if (await ShouldRequireApproval(senderId, receiverId))
                {
                    await AddMessageRequestIfNotExists(senderId, receiverId);
                    isApproved = false;

                    // Sjekk hvor mange meldinger sender allerede har sendt i denne samtalen
                    var messageCount = await _context.Messages
                        .CountAsync(m => m.ConversationId == conversation.Id && m.SenderId == senderId);

                    if (messageCount >= 5)
                    {
                        // Marker forespørselen med LimitReached = true
                        var messageRequest = await _context.MessageRequests
                            .FirstOrDefaultAsync(r => r.SenderId == senderId && r.ReceiverId == receiverId);

                        if (messageRequest != null)
                        {
                            messageRequest.LimitReached = true;
                            await _context.SaveChangesAsync();
                        }

                        return new MessageResponseDTO
                        {
                            Text = "Du har nådd maksgrensen på 5 meldinger før forespørselen godkjennes.",
                            ConversationId = conversation.Id,
                            SenderId = senderId
                        };
                    }
                }

                if (!isApproved) // Hvis meldingen ikke er godkjent
                {
                    return new MessageResponseDTO
                    {
                        Text = "Meldingen er sendt som forespørsel og vil bli synlig etter godkjenning.",
                        ConversationId = conversation.Id, // Gir ID til samtalen (slik at frontend vet hvilken samtale det gjelder)
                        SenderId = senderId // Hvem som har sendt meldingen
                    };
                }
            }
            else // Hvis samtale-ID finnes (gjelder f.eks. gruppechat eller eksisterende samtale)
            {
                conversation = await _context.Conversations
                                   .Include(c => c.Participants)
                                   .FirstOrDefaultAsync(c => c.Id == request.ConversationId)
                               ?? throw new Exception("Samtalen finnes ikke."); // Feil hvis samtalen ikke eksisterer
            }

            // 🔽 Felles for begge grener: Vi lager og lagrer meldingen i databasen
            var message = CreateMessage(senderId, conversation.Id, request, isApproved);  // Lager nytt meldingsobjekt
            _context.Messages.Add(message); // Legger meldingen til databasen
            await _context.SaveChangesAsync(); // Lagre endringer (både melding og eventuelt ny samtale)

            var response = await MapToResponseDto(message); // Mapper meldingen til DTO for frontend
            await BroadcastMessageIfApproved(conversation, senderId, response); // Sender meldingen via SignalR hvis den er godkjent

            return response; // Returnerer svar-DTO til klienten
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

            var query = _context.Messages
                .Where(m => m.ConversationId == conversationId)
                .Include(m => m.Attachments)
                .Include(m => m.Reactions)
                .Include(m => m.Sender).ThenInclude(u => u.Profile)
                .OrderByDescending(m => m.SentAt)
                .AsQueryable();

            // ✅ Hvis det er en privat samtale, vis kun godkjente meldinger
            if (!conversation.IsGroup)
            {
                var otherUserId = conversation.Participants.First(p => p.UserId != userId).UserId;

                var isApproved = await _context.Friends.AnyAsync(f =>
                                     (f.UserId == userId && f.FriendId == otherUserId) ||
                                     (f.UserId == otherUserId && f.FriendId == userId)) ||
                                 await _context.MessageRequests.AnyAsync(r =>
                                     r.SenderId == otherUserId && r.ReceiverId == userId && r.IsAccepted);

                if (!isApproved)
                {
                    // Vis kun de 5 første meldingene fra andre brukeren (begrenset forhåndsvisning)
                    var previewMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversationId && m.SenderId == otherUserId)
                        .OrderBy(m => m.SentAt)
                        .Take(5)
                        .Include(m => m.Attachments)
                        .Include(m => m.Reactions)
                        .Include(m => m.Sender).ThenInclude(u => u.Profile)
                        .ToListAsync();

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
            else
            {
                // For grupper: bruker må ha godkjent gruppeinvitasjonen
                var hasApproved = await _context.MessageRequests.AnyAsync(r =>
                    r.ReceiverId == userId &&
                    r.ConversationId == conversation.Id &&
                    r.IsAccepted);

                if (!hasApproved)
                    return new List<MessageResponseDTO>(); // Ikke vis meldinger i gruppe før godkjenning
            }

            var messages = await query
                .Skip(skip)
                .Take(take)
                .ToListAsync();

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