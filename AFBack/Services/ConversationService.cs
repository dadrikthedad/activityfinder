using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;
using AFBack.DTOs;
using AFBack.Functions;

namespace AFBack.Services;

public class ConversationService
    {
        private readonly ApplicationDbContext _context;
        private readonly SendMessageCache _msgCache;

        public ConversationService(ApplicationDbContext context, SendMessageCache msgCache)
        {
            _context = context;
            _msgCache = msgCache;
        }
        // Hente alle samtalene til en bruker som er godkjente
        public async Task<List<ConversationWithApprovalDTO>> GetUserConversationsSortedAsync(
        int userId, bool includeRejected = false)
        {
            // 🚀 RASK: Hent alle samtaler brukeren kan sende til via CanSend
            var allowedConversationIds = new HashSet<int>(
                (await _msgCache.GetUserCanSendConversationsAsync(userId))
                .Concat(await _context.MessageRequests
                    .AsNoTracking()
                    .Where(r => r.SenderId == userId && !r.IsAccepted && !r.IsRejected && r.ConversationId.HasValue)
                    .Select(r => r.ConversationId!.Value)
                    .ToListAsync()));

            var query = _context.Conversations
                .Where(c =>
                    c.Participants.Any(p => p.UserId == userId && !p.HasDeleted) &&
                    (allowedConversationIds.Contains(c.Id) || c.CreatorId == userId)
                );

            // Filtrer bort rejected hvis nødvendig
            if (!includeRejected)
            {
                query = query.Where(c =>
                    // For 1-1: ikke vis hvis bruker har rejected
                    (c.IsGroup || !_context.MessageRequests
                        .Any(r => r.ConversationId == c.Id && r.IsRejected && r.ReceiverId == userId)) &&
                    // For grupper: ikke vis hvis bruker har rejected GroupRequest
                    (!c.IsGroup || !_context.GroupRequests
                        .Any(gr => gr.ConversationId == c.Id && gr.ReceiverId == userId && gr.Status == GroupRequestStatus.Rejected))
                );
            }

            // 🎯 OPTIMALISERT: Hent GroupRequests kun for samtaler vi faktisk returnerer
            var conversations = await query
                .AsNoTracking()
                .OrderByDescending(c => c.LastMessageSentAt ?? DateTime.MinValue)
                .Include(c => c.Participants)
                .ThenInclude(p => p.User)
                .ThenInclude(u => u.Profile)
                .ToListAsync();

            // Hent GroupRequests kun for de samtalene vi returnerer
            var conversationIds = conversations.Where(c => c.IsGroup).Select(c => c.Id).ToList();
            
            var groupRequests = conversationIds.Any() 
                ? await _context.GroupRequests
                    .AsNoTracking()
                    .Where(gr => conversationIds.Contains(gr.ConversationId))
                    .ToListAsync()
                : new List<GroupRequest>();

            // Bygg lookup for GroupRequest status
            var groupRequestLookup = groupRequests
                .GroupBy(gr => gr.ConversationId)
                .ToDictionary(
                    g => g.Key,
                    g => g.ToDictionary(gr => gr.ReceiverId, gr => gr.Status)
                );

            return conversations.Select(c => new ConversationWithApprovalDTO
            {
                Conversation = c,
                IsPendingApproval = !c.IsApproved && !c.IsGroup && c.CreatorId == userId,
                GroupRequestLookup = c.IsGroup && groupRequestLookup.TryGetValue(c.Id, out var lookup)
                    ? lookup
                    : new Dictionary<int, GroupRequestStatus>()
            }).ToList();
        }
        
        // Henter alle samtelene til en bruker, burkes til SingalR chaatHub
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
        
        // Sletting av samtaler
        public async Task DeleteConversationForUserAsync(int conversationId, int userId)
        {
            // Hent conversation med participants
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conversation == null)
                throw new Exception("Samtalen finnes ikke.");

            // Kun 1-1 samtaler kan slettes på denne måten
            if (conversation.IsGroup)
                throw new Exception("Gruppesamtaler kan ikke slettes. Forlat gruppen i stedet.");

            var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
            if (participant == null)
                throw new Exception("Du er ikke medlem av denne samtalen.");

            if (participant.HasDeleted)
                throw new Exception("Du har allerede slettet denne samtalen.");

            // Marker som slettet
            participant.HasDeleted = true;
            participant.DeletedAt = DateTime.UtcNow;

            // 🆕 Fjern BEGGE brukerne fra CanSend (siden samtalen er "brutt")
            var allParticipantIds = conversation.Participants.Select(p => p.UserId).ToList();
            foreach (var participantId in allParticipantIds)
            {
                await _context.RemoveCanSendAsync(participantId, conversationId, _msgCache);
            }

            await _context.SaveChangesAsync();
        }
        
        // Gjennoppretting en samtale
        public async Task RestoreConversationForUserAsync(int conversationId, int userId)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conversation == null)
                throw new Exception("Samtalen finnes ikke.");

            if (conversation.IsGroup)
                throw new Exception("Kan ikke gjenopprette gruppesamtaler.");

            var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
            if (participant == null)
                throw new Exception("Du er ikke medlem av denne samtalen.");

            if (!participant.HasDeleted)
                throw new Exception("Samtalen er ikke slettet.");

            // Gjenopprett denne brukeren
            participant.HasDeleted = false;
            participant.DeletedAt = null;

            await _context.SaveChangesAsync();

            // 🆕 Sjekk om vi skal legge til CanSend for begge
            // Kun hvis INGEN av brukerne har slettet OG forespørselen er godkjent
            var anyUserHasDeleted = conversation.Participants.Any(p => p.HasDeleted);
    
            if (!anyUserHasDeleted && conversation.IsApproved)
            {
                // Sjekk at MessageRequest faktisk er godkjent
                var isMessageRequestAccepted = await _context.MessageRequests
                    .AsNoTracking()
                    .AnyAsync(r => r.ConversationId == conversationId && r.IsAccepted);

                if (isMessageRequestAccepted)
                {
                    // Legg til CanSend for begge brukerne
                    var allParticipantIds = conversation.Participants.Select(p => p.UserId).ToList();
                    foreach (var participantId in allParticipantIds)
                    {
                        await _context.AddCanSendAsync(participantId, conversationId, _msgCache, CanSendReason.MessageRequest);
                    }
                }
            }
        }
        
    }