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
        public async Task<List<ConversationWithApprovalDTO>> GetUserConversationsSortedAsync(
        int userId, bool includeRejected = false)
        {
            // Hent godkjente 1-til-1 MessageRequests
            var approvedMessageRequestConvIds = new HashSet<int>(await _context.MessageRequests
                .Where(r => r.ReceiverId == userId && r.IsAccepted && r.ConversationId != null)
                .Select(r => r.ConversationId!.Value)
                .ToListAsync());

            // Hent godkjente GroupRequests for denne brukeren
            var approvedGroupConvIds = new HashSet<int>(await _context.GroupRequests
                .Where(gr => gr.ReceiverId == userId && gr.Status == GroupRequestStatus.Approved)
                .Select(gr => gr.ConversationId)
                .ToListAsync());

            // Hent alle gruppe-samtale-id-er brukeren er deltaker i
            var myGroupConversationIds = await _context.Conversations
                .Where(c => c.IsGroup && c.Participants.Any(p => p.UserId == userId))
                .Select(c => c.Id)
                .ToListAsync();

            // Hent alle GroupRequests for disse samtalene
            var groupRequests = await _context.GroupRequests
                .Where(gr => myGroupConversationIds.Contains(gr.ConversationId))
                .ToListAsync();

            // Bygg lookup for å finne status per (ConversationId, UserId)
            var groupRequestLookup = groupRequests
                .GroupBy(gr => gr.ConversationId)
                .ToDictionary(
                    g => g.Key,
                    g => g.ToDictionary(gr => gr.ReceiverId, gr => gr.Status) // <int, GroupRequestStatus>
                );

            var query = _context.Conversations
                .Where(c =>
                    c.Participants.Any(p => p.UserId == userId) &&
                    (
                        (!c.IsGroup && (c.IsApproved || c.CreatorId == userId || approvedMessageRequestConvIds.Contains(c.Id))) ||
                        (c.IsGroup && (c.CreatorId == userId || approvedGroupConvIds.Contains(c.Id)))
                    )
                );

            if (!includeRejected)
            {
                query = query.Where(c =>
                    (c.IsGroup || !_context.MessageRequests
                        .Any(r => r.ConversationId == c.Id && r.IsRejected && r.SenderId != userId)) &&
                    (!c.IsGroup || c.CreatorId == userId || !_context.GroupRequests
                        .Any(gr => gr.ConversationId == c.Id && gr.ReceiverId == userId && gr.Status == GroupRequestStatus.Rejected))
                );
            }

            var conversations = await query
                .OrderByDescending(c => c.LastMessageSentAt ?? DateTime.MinValue)
                .Include(c => c.Participants)
                .ThenInclude(p => p.User)
                .ThenInclude(u => u.Profile)
                .ToListAsync();

            return conversations.Select(c => new ConversationWithApprovalDTO
            {
                Conversation = c,
                IsPendingApproval = !c.IsApproved && !c.IsGroup && c.CreatorId == userId,
                GroupRequestLookup = c.IsGroup && groupRequestLookup.TryGetValue(c.Id, out var lookup)
                    ? lookup
                    : new Dictionary<int, GroupRequestStatus>()
            }).ToList();
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
        
        // Her henter vi totalt antall meldinger ulest
        public async Task<UnreadSummaryDTO> GetUnreadSummaryAsync(int userId)
        {
            var readStates = await _context.ConversationReadStates
                .Where(r => r.UserId == userId)
                .ToDictionaryAsync(r => r.ConversationId, r => r.LastReadAt);

            // ✅ Bruk eksisterende service som allerede har riktig tilgangslogikk
            var conversationResults = await GetUserConversationsSortedAsync(userId, includeRejected: false);
    
            // Hent conversation IDs som brukeren har tilgang til
            var accessibleConversationIds = conversationResults.Select(cr => cr.Conversation.Id).ToHashSet();

            // Hent meldinger for disse samtalene
            var conversationsWithMessages = await _context.Conversations
                .Include(c => c.Messages)
                .Where(c => accessibleConversationIds.Contains(c.Id))
                .ToListAsync();

            var result = new UnreadSummaryDTO();

            foreach (var conversation in conversationsWithMessages)
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