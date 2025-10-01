using AFBack.Constants;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;
using AFBack.DTOs;
using AFBack.Extensions;
using AFBack.Features.Cache.Interface;
using AFBack.Functions;
using AFBack.Interface.Services;

namespace AFBack.Services;

public class ConversationService(
    ApplicationDbContext context,
    ISendMessageCache msgCache,
    IBackgroundTaskQueue taskQueue,
    IServiceScopeFactory scopeFactory,
    ILogger<ConversationService> logger)
{
    // Hente alle samtalene til en bruker som er godkjente
        public async Task<List<ConversationWithApprovalDTO>> GetUserConversationsSortedAsync(
        int userId, bool includeRejected = false, int? limit = null)
        {
            // 🚀 RASK: Hent alle samtaler brukeren kan sende til via CanSend
            var allowedConversationIds = new HashSet<int>(
                (await msgCache.GetUserCanSendConversationsAsync(userId))
                .Concat(await context.MessageRequests
                    .AsNoTracking()
                    .Where(r => r.SenderId == userId && !r.IsAccepted && !r.IsRejected && r.ConversationId.HasValue)
                    .Select(r => r.ConversationId!.Value)
                    .ToListAsync()));

            var query = context.Conversations
                .Where(c =>
                    c.Participants.Any(p => p.UserId == userId && !p.HasDeleted) &&
                    (allowedConversationIds.Contains(c.Id) || c.CreatorId == userId)
                );

            // Filtrer bort rejected hvis nødvendig
            if (!includeRejected)
            {
                query = query.Where(c =>
                    // For 1-1: ikke vis hvis bruker har rejected
                    (c.IsGroup || !context.MessageRequests
                        .Any(r => r.ConversationId == c.Id && r.IsRejected && r.ReceiverId == userId)) &&
                    // For grupper: ikke vis hvis bruker har rejected GroupRequest
                    (!c.IsGroup || !context.GroupRequests
                        .Any(gr => gr.ConversationId == c.Id && gr.ReceiverId == userId && gr.Status == GroupRequestStatus.Rejected))
                );
            }
            
            IQueryable<Conversation> finalQuery = query
                .AsNoTracking()
                .OrderByDescending(c => c.LastMessageSentAt ?? DateTime.MinValue);

            // Legg til limit hvis spesifisert
            if (limit.HasValue)
            {
                finalQuery = finalQuery.Take(limit.Value);
            }
            

            // 🎯 OPTIMALISERT: Hent GroupRequests kun for samtaler vi faktisk returnerer
            var conversations = await finalQuery
                .Include(c => c.Participants)
                .ThenInclude(p => p.User)
                .ThenInclude(u => u.Profile)
                .ToListAsync();

            // Hent GroupRequests kun for de samtalene vi returnerer
            var conversationIds = conversations.Where(c => c.IsGroup).Select(c => c.Id).ToList();
            
            var groupRequests = conversationIds.Any() 
                ? await context.GroupRequests
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
        
        
        // Når en bruker åpner en samtale så sjekker vi om vi har lest meldingen for å fjerne notifasjonen
        public async Task MarkConversationAsReadAsync(int userId, int conversationId)
        {
            var existing = await context.ConversationReadStates
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ConversationId == conversationId);

            if (existing == null)
            {
                var state = new ConversationReadState
                {
                    UserId = userId,
                    ConversationId = conversationId,
                    LastReadAt = DateTime.UtcNow
                };
                context.ConversationReadStates.Add(state);
            }
            else
            {
                existing.LastReadAt = DateTime.UtcNow;
            }

            await context.SaveChangesAsync();
        }
        
        // Her henter vi totalt antall meldinger ulest
        public async Task<UnreadSummaryDTO> GetUnreadSummaryAsync(int userId)
        {
            var readStates = await context.ConversationReadStates
                .Where(r => r.UserId == userId)
                .ToDictionaryAsync(r => r.ConversationId, r => r.LastReadAt);

            // ✅ Bruk eksisterende service som allerede har riktig tilgangslogikk
            var conversationResults = await GetUserConversationsSortedAsync(userId, includeRejected: false);
    
            // Hent conversation IDs som brukeren har tilgang til
            var accessibleConversationIds = conversationResults.Select(cr => cr.Conversation.Id).ToHashSet();

            // Hent meldinger for disse samtalene
            var conversationsWithMessages = await context.Conversations
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
            var conversation = await context.Conversations
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
                await context.RemoveCanSendAsync(participantId, conversationId, msgCache);
            }

            await context.SaveChangesAsync();
            
            // 🆕 SYNC EVENT - etter SaveChanges
            taskQueue.QueueAsync(async () => 
            {
                using var scope = scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
        
                try 
                {
                    // Sync event kun for brukeren som slettet (ikke den andre parten)
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.CONVERSATION_LEFT,
                        eventData: conversationId,
                        singleUserId: userId, // Kun til brukeren som slettet
                        source: "API",
                        relatedEntityId: conversationId,
                        relatedEntityType: "Conversation"
                    );
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to create sync event for conversation deletion. ConversationId: {ConversationId}, UserId: {UserId}", 
                        conversationId, userId);
                }
            });
        }
        
        // Gjennoppretting en samtale
        public async Task RestoreConversationForUserAsync(int conversationId, int userId)
        {
            var conversation = await context.Conversations
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

            // Sjekk om vi skal legge til CanSend for begge
            // Kun hvis INGEN av brukerne har slettet OG samtalen er godkjent
            var anyUserStillHasDeleted = conversation.Participants.Any(p => p.HasDeleted && p.UserId != userId);

            if (!anyUserStillHasDeleted && conversation.IsApproved)
            {
                // 🆕 Alternativ: Sjekk MessageRequest hvis nødvendig
                var isMessageRequestAccepted = await context.MessageRequests
                    .AsNoTracking()
                    .AnyAsync(r => r.ConversationId == conversationId && r.IsAccepted);

                if (isMessageRequestAccepted)
                {
                    // 🆕 Legg til CanSend for begge brukerne (mer effektivt)
                    var participantIds = conversation.Participants.Select(p => p.UserId).ToList();
            
                    foreach (var participantId in participantIds)
                    {
                        await context.AddCanSendAsync(participantId, conversationId, msgCache, CanSendReason.MessageRequest);
                    }
            
                    Console.WriteLine($"✅ Gjenopprettet CanSend for {participantIds.Count} brukere i samtale {conversationId}");
                }
            }

            await context.SaveChangesAsync();
            
            // 🆕 Hent user data for participants (samme som ApproveMessageRequestAsync)
            var userIds = conversation.Participants.Select(p => p.UserId).ToArray();
            var userData = await SyncEventExtensions.GetUserDataAsync(context, userIds);

            var conversationSyncData = conversation.MapConversationToSyncData(userId, userData);
            
            // SYNC EVENT - etter SaveChanges
            taskQueue.QueueAsync(async () => 
            {
                using var scope = scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();

                try 
                {
                    // Sync event kun for brukeren som gjenopprettet (ikke den andre parten)
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.CONVERSATION_RESTORED,
                        eventData: conversationSyncData,
                        singleUserId: userId, // Kun til brukeren som gjenopprettet
                        source: "API",
                        relatedEntityId: conversationId,
                        relatedEntityType: "Conversation"
                    );
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to create sync event for conversation restoration. ConversationId: {ConversationId}, UserId: {UserId}", 
                        conversationId, userId);
                }
            });
        }
        
    }