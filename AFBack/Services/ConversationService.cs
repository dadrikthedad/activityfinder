using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;
using AFBack.DTOs;

namespace AFBack.Services;

public class ConversationService
    {
        private readonly ApplicationDbContext _context;

        public ConversationService(ApplicationDbContext context)
        {
            _context = context;
        }
        // Hente alle samtalene til en bruker som er godkjente
        public async Task<List<Conversation>> GetUserConversationsSortedAsync(int userId)
        {
            return await _context.Conversations
                .Include(c => c.Participants)
                .ThenInclude(p => p.User)
                .ThenInclude(u => u.Profile)
                .Include(c => c.Messages)
                .Where(c =>
                    c.Participants.Any(p => p.UserId == userId) && // Brukeren er deltaker
                    (
                        !c.IsGroup && (
                            _context.Friends.Any(f =>
                                (f.UserId == userId && c.Participants.Any(p => p.UserId == f.FriendId)) ||
                                (f.FriendId == userId && c.Participants.Any(p => p.UserId == f.UserId))
                            ) ||
                            _context.MessageRequests.Any(r =>
                                r.ReceiverId == userId &&
                                c.Participants.Any(p => p.UserId == r.SenderId) &&
                                r.IsAccepted
                            )
                        )
                        ||
                        (c.IsGroup &&
                         _context.MessageRequests.Any(r =>
                             r.ReceiverId == userId &&
                             r.ConversationId == c.Id &&
                             r.IsAccepted
                         )
                        )
                    )
                )
                .OrderByDescending(c => c.Messages.Max(m => (DateTime?)m.SentAt) ?? DateTime.MinValue)
                .ToListAsync();
            
        }

        // Opprette en gurppe
        public async Task<Conversation> CreateGroupAsync(string groupName)
        {
            if (await _context.Conversations.AnyAsync(c => c.GroupName == groupName && c.IsGroup))
                throw new Exception("En gruppe med dette navnet finnes allerede.");

            var group = new Conversation
            {
                GroupName = groupName,
                IsGroup = true
            };

            _context.Conversations.Add(group);
            await _context.SaveChangesAsync();
            return group;
        }
        // Legge til en bruker i en gruppe
        public async Task InviteParticipantAsync(int conversationId, int inviterId, int invitedUserId, bool autoAccept = false)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.IsGroup);

            if (conversation == null)
                throw new Exception("Gruppesamtale ikke funnet.");
            
            // Brukeren er allerede deltaker?
            if (conversation.Participants.Any(p => p.UserId == invitedUserId))
                throw new Exception("Brukeren er allerede deltaker i gruppen.");
            
            var isBlocked = await _context.GroupBlocks
                .AnyAsync(b => b.UserId == invitedUserId && b.ConversationId == conversationId);
            
            if (isBlocked)
                throw new Exception("Denne brukeren har blokkert invitasjoner til denne gruppen.");
            
            
            

            if (autoAccept)
            {
                // Legg direkte til som deltaker
                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversationId,
                    UserId = invitedUserId
                });
            }
            else
            {
                // Sjekk om invitasjon finnes fra før
                var alreadyInvited = await _context.GroupInviteRequests
                    .AnyAsync(r => r.ConversationId == conversationId && r.InvitedUserId == invitedUserId && !r.IsAccepted);

                if (!alreadyInvited)
                {
                    _context.GroupInviteRequests.Add(new GroupInviteRequest
                    {
                        ConversationId = conversationId,
                        InviterId = inviterId,
                        InvitedUserId = invitedUserId,
                        IsAccepted = false,
                        RequestedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
        }
        
        // Fjerne en bruker fra en gruppe
        public async Task RemoveParticipantAsync(int conversationId, int userId)
        {
            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);

            if (participant != null)
            {
                _context.ConversationParticipants.Remove(participant);
                await _context.SaveChangesAsync();
            }
        }
        // Henter alle samtelene til en bruker
        public async Task<List<Conversation>> GetUserConversationsAsync(int userId, bool isGroup)
        {
            return await _context.Conversations
                .Where(c => c.IsGroup == isGroup && c.Participants.Any(p => p.UserId == userId))
                .Include(c => c.Participants)
                .ThenInclude(p => p.User)
                .ThenInclude(u => u.Profile)
                .ToListAsync();
        }
        // Henter meldinger for å vise samtalene
        public async Task<Conversation?> GetConversationByIdAsync(int conversationId)
        {
            return await _context.Conversations
                .Include(c => c.Participants)
                .Include(c => c.Messages.Where(m => !m.IsDeleted)) // ✅ bare aktive meldinger
                .ThenInclude(m => m.Reactions)
                .Include(c => c.Messages.Where(m => !m.IsDeleted))
                .ThenInclude(m => m.Attachments)
                .Include(c => c.Messages.Where(m => !m.IsDeleted))
                .ThenInclude(m => m.ParentMessage)
                .FirstOrDefaultAsync(c => c.Id == conversationId);
        }
        
        // Slette en gruppe
        public async Task DeleteGroupAsync(int conversationId)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .Include(c => c.Messages)
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conversation == null)
                throw new Exception("Samtalen ble ikke funnet.");

            if (!conversation.IsGroup)
                throw new Exception("Kan ikke slette en privat samtale som gruppe.");

            _context.Conversations.Remove(conversation);
            await _context.SaveChangesAsync();
        }
        
        // Når en bruker åpner en samtale så sjekker vi om vi har lest meldingen for å fjerne notifasjonen
        public async Task MarkConversationAsReadAsync(int userId, int conversationId)
        {
            var existing = await _context.ConversationReadStates
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ConversationId == conversationId);

            if (existing == null)
            {
                var state = new ConversationReadState
                {
                    UserId = userId,
                    ConversationId = conversationId,
                    LastReadAt = DateTime.UtcNow
                };
                _context.ConversationReadStates.Add(state);
            }
            else
            {
                existing.LastReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }
        
        // Henter antall uleste meldinger i en samtale
        public async Task<Dictionary<int, int>> GetUnreadMessageCountsAsync(int userId)
        {
            var states = await _context.ConversationReadStates
                .Where(r => r.UserId == userId)
                .ToDictionaryAsync(r => r.ConversationId, r => r.LastReadAt);

            var conversations = await _context.Conversations
                .Include(c => c.Participants)
                .Include(c => c.Messages)
                .Where(c => c.Participants.Any(p => p.UserId == userId))
                .ToListAsync();

            var result = new Dictionary<int, int>();

            foreach (var conversation in conversations)
            {
                var lastRead = states.TryGetValue(conversation.Id, out var value)
                    ? value
                    : DateTime.MinValue;

                var unreadCount = conversation.Messages
                    .Where(m => m.SentAt > lastRead && m.SenderId != userId)
                    .Count();

                result[conversation.Id] = unreadCount;
            }

            return result;
        }
        // Her henter vi totalt antall meldinger ulest
        public async Task<UnreadSummaryDTO> GetUnreadSummaryAsync(int userId)
        {
            
            var readStates = await _context.ConversationReadStates
                .Where(r => r.UserId == userId)
                .ToDictionaryAsync(r => r.ConversationId, r => r.LastReadAt);

            // Samtaler brukeren er med i
            var conversations = await _context.Conversations
                .Include(c => c.Participants)
                .Include(c => c.Messages)
                .Where(c => c.Participants.Any(p => p.UserId == userId))
                .ToListAsync();

            var result = new UnreadSummaryDTO();

            foreach (var conversation in conversations)
            {
                var lastRead = readStates.TryGetValue(conversation.Id, out var value)
                    ? value
                    : DateTime.MinValue;

                var unreadCount = conversation.Messages
                    .Where(m => m.SentAt > lastRead && m.SenderId != userId)
                    .Count();

                if (unreadCount > 0)
                {
                    result.PerConversation[conversation.Id] = unreadCount;
                    result.TotalUnread += unreadCount;
                }
            }

            return result;
        }
        
        
        
    }