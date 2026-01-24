using AFBack.Cache;
using AFBack.Constants;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;
using AFBack.DTOs;
using AFBack.Extensions;
using AFBack.Features.Cache.Interface;
using AFBack.Features.SyncEvents.Services;
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
        // public async Task<List<Conversations>> GetUserConversationsSortedAsync(
        //     int userId, bool includeRejected = false, int? limit = null)
        // {
        //     // 🚀 RASK: Hent alle samtaler brukeren kan sende til via CanSend
        //     var allowedConversationIds = new HashSet<int>(
        //         (await msgCache.GetUserCanSendConversationsAsync(userId))
        //         .Concat(await context.MessageRequests
        //             .AsNoTracking()
        //             .Where(r => r.SenderId == userId && !r.IsAccepted && !r.IsRejected && r.ConversationId.HasValue)
        //             .Select(r => r.ConversationId!.Value)
        //             .ToListAsync()));
        //
        //     var query = context.Conversations
        //         .Where(c =>
        //             c.Participants.Any(p => p.UserId == userId && !p.ConversationArchived) &&
        //             (allowedConversationIds.Contains(c.Id) || c.CreatorId == userId)
        //         );
        //
        //     // Filtrer bort rejected hvis nødvendig
        //     if (!includeRejected)
        //     {
        //         query = query.Where(c =>
        //             // Ekskluder samtaler hvor brukerens egen status er Rejected
        //             !c.Participants.Any(p => p.UserId == userId && p.ConversationStatus == ConversationStatus.Rejected)
        //         );
        //     }
        //
        //     IQueryable<Conversations> finalQuery = query
        //         .AsNoTracking()
        //         .OrderByDescending(c => c.LastMessageSentAt ?? DateTime.MinValue);
        //
        //     // Legg til limit hvis spesifisert
        //     if (limit.HasValue)
        //     {
        //         finalQuery = finalQuery.Take(limit.Value);
        //     }
        //
        //     // 🎯 Hent conversations med participants
        //     var conversations = await finalQuery
        //         .Include(c => c.Participants)
        //         .ThenInclude(p => p.AppUser)
        //         .ThenInclude(u => u.UserProfile)
        //         .ToListAsync();
        //
        //     return conversations;
        // }
        
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
            var conversations = await GetUserConversationsSortedAsync(userId, includeRejected: false);

            // Hent conversation IDs som brukeren har tilgang til
            var accessibleConversationIds = conversations.Select(c => c.Id).ToHashSet();

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
        
        // // Sletting av samtaler
        // public async Task DeleteConversationForUserAsync(int conversationId, int userId)
        // {
        //     // Hent conversation med participants
        //     var conversation = await context.Conversations
        //         .Include(c => c.Participants)
        //         .FirstOrDefaultAsync(c => c.Id == conversationId);
        //
        //     if (conversation == null)
        //         throw new Exception("Samtalen finnes ikke.");
        //
        //     // Kun 1-1 samtaler kan slettes på denne måten
        //     if (conversation.IsGroup)
        //         throw new Exception("Gruppesamtaler kan ikke slettes. Forlat gruppen i stedet.");
        //
        //     var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        //     if (participant == null)
        //         throw new Exception("Du er ikke medlem av denne samtalen.");
        //
        //     if (participant.ConversationArchived)
        //         throw new Exception("Du har allerede slettet denne samtalen.");
        //
        //     // Marker som slettet
        //     participant.ConversationArchived = true;
        //     participant.ArchivedAt = DateTime.UtcNow;
        //
        //     // 🆕 Fjern BEGGE brukerne fra CanSend (siden samtalen er "brutt")
        //     var allParticipantIds = conversation.Participants.Select(p => p.UserId).ToList();
        //     foreach (var participantId in allParticipantIds)
        //     {
        //         await context.RemoveCanSendAsync(participantId, conversationId, msgCache);
        //     }
        //
        //     await context.SaveChangesAsync();
        //     
        //     // 🆕 SYNC EVENT - etter SaveChanges
        //     taskQueue.QueueAsync(async () => 
        //     {
        //         using var scope = scopeFactory.CreateScope();
        //         var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
        //
        //         try 
        //         {
        //             // Sync event kun for brukeren som slettet (ikke den andre parten)
        //             await syncService.CreateAndDistributeSyncEventAsync(
        //                 eventType: SyncEventTypes.CONVERSATION_LEFT,
        //                 eventData: conversationId,
        //                 singleUserId: userId, // Kun til brukeren som slettet
        //                 source: "API",
        //                 relatedEntityId: conversationId,
        //                 relatedEntityType: "Conversations"
        //             );
        //         }
        //         catch (Exception ex)
        //         {
        //             logger.LogError(ex, "Failed to create sync event for conversation deletion. ConversationId: {ConversationId}, UserId: {UserId}", 
        //                 conversationId, userId);
        //         }
        //     });
        // }
        
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

            if (!participant.ConversationArchived)
                throw new Exception("Samtalen er ikke slettet.");

            // Gjenopprett denne brukeren
            participant.ConversationArchived = false;
            participant.ArchivedAt = null;

            // Sjekk om vi skal legge til CanSend for begge
            // Kun hvis INGEN av brukerne har slettet OG samtalen er godkjent
            var anyUserStillHasDeleted = conversation.Participants.Any(p => p.ConversationArchived && p.UserId != userId);

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
            
            // 🆕 Hent appUser data for participants (samme som ApproveMessageRequestAsync)
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
                        relatedEntityType: "Conversations"
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
