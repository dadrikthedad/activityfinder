// using AFBack.Cache;
// using AFBack.Constants;
// using AFBack.Controllers;
// using AFBack.Data;
// using AFBack.Models;
// using AFBack.DTOs;
// using AFBack.DTOs.Crypto;
// using AFBack.Functions;
// using AFBack.Hubs;
// using Microsoft.AspNetCore.SignalR;
// using Microsoft.EntityFrameworkCore;
// using AFBack.Extensions;
// using AFBack.Features.Cache.Interface;
// using AFBack.Features.Conversation.Models;
// using AFBack.Features.MessageNotification.Service;
// using AFBack.Features.SyncEvents.Services;
// using AFBack.Interface.Services;
// using AFBack.Models.Crypto;
// using Newtonsoft.Json;
// using EncryptedMessage = AFBack.Features.Messaging.Models.Message;
//
// // En service for å håndtere alle meldinger
// namespace AFBack.Services;
//
// public class MessageService(
//     ApplicationDbContext context,
//     IHubContext<UserHub> hubContext,
//     IMessageNotificationService messageNotificationService,
//     ISendMessageCache msgCache,
//     IBackgroundTaskQueue taskQueue,
//     IServiceScopeFactory scopeFactory,
//     ILogger<UserController> logger,
//     ISyncService syncService)
//     : IMessageService
// {

    // Her sender vi en melding med SendMessageAsync, sender også med vedlegg
    // public async Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO dto)
    // {
    //     if (dto.ReceiverId != null && int.TryParse(dto.ReceiverId, out var rid) && rid == senderId) 
    //         throw new("Du kan ikke sende en melding til deg selv.");
    //     
    //     if (dto.ParentMessageId.HasValue)
    //     {
    //         var parentExists = await context.Messages
    //             .AsNoTracking()
    //             .AnyAsync(m => m.Id == dto.ParentMessageId.Value);
    //     
    //         if (!parentExists)
    //             throw new Exception("Parent message ikke funnet.");
    //     }
    //     
    //     if (dto.ConversationId > 0)
    //     {
    //         var fastValidation = await ValidateExistingConversationFast(senderId, dto.ConversationId);
    //         if (fastValidation.CanSend)
    //         {
    //             // 🎯 HYPER-RASK BANE: Hopp direkte til meldingsopprettelse
    //             return await CreateAndSaveMessageFast(senderId, dto, fastValidation.Conversations);
    //         }
    //     
    //         // Hvis ikke kan sende, fall tilbake til full validering
    //     }
    //     
    //     // 1️  Finn eller lag samtalen (1 query, ingen commit hvis den finnes)
    //     var (conversation, receiverId) = dto.ConversationId > 0 
    //         ? await GetExistingConversation(senderId, dto.ConversationId)
    //         : await GetOrCreateConversationFast(senderId, dto);
    //
    //     Dictionary<int, (string FullName, string? ProfileImageUrl)>? userData = null;
    //
    //     if (dto.ConversationId <= 0 && !conversation.IsGroup && receiverId.HasValue)
    //     {
    //         userData = await SyncEventExtensions.GetUserDataAsync(context, senderId, receiverId.Value);
    //     }
    //     
    //     if (!conversation.IsGroup && !receiverId.HasValue)
    //         throw new InvalidOperationException("receiverId skal være satt i 1–1 samtale.");
    //     
    //     // Sjekk cahcen om vi kan sende
    //     bool canSend = await msgCache.CanUserSendAsync(senderId, conversation.Id);
    //
    //     MessageResponseDTO response;
    //     
    //     if (!canSend)
    //     {
    //         // 2️  Blokkeringssjekk  (treffer cache først)
    //         if (!conversation.IsGroup)
    //         {
    //             // 🚀 Hent participants og blocking-data i separate, effektive queries
    //             var participantData = await context.ConversationParticipants
    //                 .AsNoTracking()
    //                 .Where(p => p.ConversationId == conversation.Id && 
    //                             (p.UserId == senderId || p.UserId == receiverId.Value))
    //                 .Select(p => new { p.UserId, p.ConversationArchived })
    //                 .ToListAsync();
    //
    //             var blockedRelations = await context.UserBlocks
    //                 .AsNoTracking() // 🆕 Glem ikke AsNoTracking
    //                 .Where(ub =>
    //                     (ub.BlockerId == senderId && ub.BlockedUserId == receiverId.Value) ||
    //                     (ub.BlockerId == receiverId.Value && ub.BlockedUserId == senderId))
    //                 .ToListAsync();
    //
    //             // Rask in-memory prosessering
    //             var senderData = participantData.FirstOrDefault(r => r.UserId == senderId);
    //             var receiverData = participantData.FirstOrDefault(r => r.UserId == receiverId.Value);
    //
    //             bool senderBlockedReceiver = blockedRelations.Any(ub => ub.BlockerId == senderId);
    //             bool receiverBlockedSender = blockedRelations.Any(ub => ub.BlockerId == receiverId.Value);
    //
    //             // Sjekker i riktig rekkefølge
    //             if (receiverData?.ConversationArchived == true || receiverBlockedSender)
    //                 throw new Exception("This appUser has been deleted or is no longer visible, or you lack the required permission to send messages.");
    //
    //             if (senderBlockedReceiver)
    //                 throw new Exception("You can't send messages to an appUser you have blocked.");
    //
    //             if (senderData?.ConversationArchived == true)
    //                 throw new Exception("You cannot send messages to a conversation you have deleted.");
    //         }
    //
    //         // 3️  Må meldingen godkjennes? (3. og evt. 4. query)
    //         bool requiresApproval = false;
    //         bool isRejected = false;
    //         bool requestSent = false;
    //
    //         if (conversation.IsGroup)
    //         {
    //             // For gruppesamtaler: sjekk GroupRequest eller om bruker er creator
    //             bool hasApprovedGroupRequest = await context.GroupRequests.AsNoTracking()
    //                 .AnyAsync(gr => gr.ConversationId == conversation.Id &&
    //                                 gr.ReceiverId == senderId &&
    //                                 gr.Status == GroupRequestStatus.Approved);
    //
    //             bool isCreator = conversation.CreatorId == senderId;
    //
    //             requiresApproval = !(hasApprovedGroupRequest || isCreator);
    //
    //             if (requiresApproval)
    //                 throw new Exception("Du må godkjenne gruppesamtalen før du kan sende meldinger.");
    //         }
    //         else
    //         {
    //             // For 1-1 samtaler: bruk den eksisterende metoden
    //             (requiresApproval, isRejected, requestSent) = await ShouldRequireApprovalFast(
    //                 senderId, receiverId.Value, conversation);
    //
    //             if (requiresApproval)
    //             {
    //                 if (isRejected && !requestSent)
    //                 {
    //                     throw new Exception(
    //                         "You have rejected this message request. Accept it from /Chat to send a message to this appUser.");
    //                 }
    //             }
    //         }
    //
    //         int messageCount = 0;
    //         bool needsMessageRequestNotification = false; // Flagg for å huske notification
    //
    //         if (!conversation.IsGroup && requiresApproval)
    //         {
    //             //  Teller meldinger **bare** når det trengs
    //             messageCount = await context.Messages.AsNoTracking()
    //                 .CountAsync(m => m.ConversationId == conversation.Id &&
    //                                  m.SenderId == senderId);
    //
    //             if (messageCount >= 5)
    //             {
    //                 MarkLimitReached(senderId, receiverId, conversation.Id);
    //                 await context.SaveChangesAsync();
    //                 throw new Exception(
    //                     "You have reached the limit of messages you can send while waiting for the receiver to accept your request.");
    //             }
    //
    //             // Sjekk om vi trenger å lage ny MessageRequest
    //             needsMessageRequestNotification = AddMessageRequestEntityIfMissing(senderId, receiverId, conversation);
    //         }
    //         else if (!conversation.IsGroup && !conversation.IsApproved)
    //         {
    //             conversation.IsApproved = true;
    //         }
    //
    //         // Brukeren svarer på en åpen meldingsforespørsel som de ikke selv har sendt.
    //         // Dette tolkes som en godkjenning – men bare dersom det faktisk finnes en ubehandlet forespørsel.
    //         bool nowApproved = false;
    //         
    //
    //         // 5  Lag selve meldingen
    //         var message = CreateMessage(senderId, conversation.Id, dto, !requiresApproval);
    //
    //         if (conversation.Id == 0) // samtalen er ny
    //             message.Conversations = conversation;
    //         else
    //             message.ConversationId = conversation.Id;
    //
    //         context.Messages.Add(message);
    //         conversation.LastMessageSentAt = message.SentAt;
    //
    //         // 6 ÉN lagring av alt ovenfor
    //         await context.SaveChangesAsync();
    //         
    //         if (!conversation.IsGroup && requiresApproval && !isRejected && !requestSent)
    //         {
    //             var existingRequest = await context.MessageRequests
    //                 .AsNoTracking()
    //                 .AnyAsync(r => r.ConversationId == conversation.Id &&
    //                                r.ReceiverId == senderId &&
    //                                !r.IsAccepted && !r.IsRejected);
    //
    //             if (existingRequest)
    //             {
    //                 await ApproveMessageRequestAsync(senderId, conversation.Id);
    //                 
    //                 await context.AddCanSendAsync(senderId, conversation.Id, msgCache, CanSendReason.MessageRequest);
    //                 await context.AddCanSendAsync(receiverId.Value, conversation.Id, msgCache, CanSendReason.MessageRequest);
    //                 
    //                 nowApproved = true;
    //             }
    //         }
    //         else if (!requiresApproval)
    //         {
    //             // 🚨 BACKUP: Dette burde ikke skje ofte
    //             logger.LogWarning("CanSend backup triggered for appUser {SenderId} in conversation {ConversationId}. " +
    //                                "Consider adding CanSend at the proper time.", senderId, conversation.Id);
    //
    //             await context.AddCanSendAsync(senderId, conversation.Id, msgCache, 
    //                 conversation.IsGroup ? CanSendReason.GroupRequest : CanSendReason.Friendship);
    //         }
    //
    //         // 🆕 Hent meldingen på nytt med full parent data
    //         response = await MapToResponseDtoOptimized(message.Id);
    //
    //         if (nowApproved)
    //         {
    //             response.IsNowApproved = true;
    //         }
    //         
    //         if (isRejected && requestSent)
    //         {
    //             response.IsRejectedRequest = true;
    //         }
    //
    //         var participantIds = conversation.Participants
    //             .Select(p => p.UserId)
    //             .ToArray();
    //
    //         // Rett før køing
    //         var shouldNotify = !requiresApproval || (messageCount > 0 && !isRejected) || nowApproved;
    //         var isRejectedSender = isRejected && requestSent;
    //
    //         // NotifyAndBroadcastAsync
    //         if (shouldNotify || needsMessageRequestNotification || isRejectedSender)
    //         {
    //             taskQueue.QueueAsync(async () => 
    //             {
    //                 // Først SignalR
    //                 await NotifyAndBroadcastAsync(
    //                     conversationId: conversation.Id,
    //                     isGroup: conversation.IsGroup,
    //                     groupName: conversation.GroupName,
    //                     groupImageUrl: conversation.GroupImageUrl,
    //                     participantIds: participantIds,
    //                     senderId: senderId,
    //                     receiverId: receiverId,
    //                     response: response,
    //                     shouldSendSignalR: shouldNotify,
    //                     shouldCreateNotifications: shouldNotify,
    //                     needsMessageRequestNotification: needsMessageRequestNotification,
    //                     isRejectedSender: isRejectedSender);
    //     
    //                 // Så sync event med ny scope
    //                 using var scope = scopeFactory.CreateScope();
    //                 var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>(); // eller hva _syncService heter
    //     
    //                 try 
    //                 {
    //                     // Sync event til oppretter av meldingsforespørselen (CONVERSATION_CREATED)
    //                     if (needsMessageRequestNotification && !conversation.IsGroup)
    //                     {
    //                         var conversationData = conversation.MapConversationToSyncData(senderId, userData);
    //     
    //                         await syncService.CreateAndDistributeSyncEventAsync(
    //                             eventType: SyncEventTypes.CONVERSATION_CREATED,
    //                             eventData: new { 
    //                                 conversationData,           // Pending-samtalen
    //                                 message = response           // 🆕 Den faktiske meldingen brukeren sendte
    //                             },
    //                             singleUserId: senderId,
    //                             source: "API",
    //                             relatedEntityId: conversation.Id,
    //                             relatedEntityType: "Conversations" 
    //                         );
    //                     }
    //
    //                     // Sync event for ny message request (MESSAGE_REQUEST_RECEIVED)
    //                     if (needsMessageRequestNotification && !conversation.IsGroup && receiverId.HasValue)
    //                     {
    //                         var messageRequestData = conversation.MapToRequestDTO(
    //                             senderId: senderId,
    //                             requestedAt: DateTime.UtcNow,
    //                             userData: userData,
    //                             isGroupRequest: false // 🆕 False for message requests
    //                         );
    //     
    //                         await syncService.CreateAndDistributeSyncEventAsync(
    //                             eventType: SyncEventTypes.REQUEST_RECEIVED,
    //                             eventData: new { 
    //                                 messageRequestData,           // Pending-samtalen
    //                                 message = response           // Den faktiske meldingen brukeren sendte
    //                             },
    //                             singleUserId: receiverId.Value,
    //                             source: "API",
    //                             relatedEntityId: conversation.Id,
    //                             relatedEntityType: "MessageRequest"
    //                         );
    //                     }
    //                     
    //                     Dictionary<int, string>? groupRequestStatuses = null;
    //                     if (conversation.IsGroup)
    //                     {
    //                         groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
    //                             context, conversation.Id, participantIds);
    //                     }
    //
    //                     // Eksisterende NEW_MESSAGE sync event
    //                     await syncService.CreateAndDistributeSyncEventAsync(
    //                         eventType: SyncEventTypes.NEW_MESSAGE,
    //                         eventData: new {
    //                             message = response,  // MessageResponseDTO
    //                             conversation = conversation.MapConversationToSyncData(senderId, userData, groupRequestStatuses)
    //                         },
    //                         targetUserIds: participantIds,
    //                         source: "API",
    //                         relatedEntityId: response.Id,
    //                         relatedEntityType: "Message"
    //                     );
    //                 }
    //                 catch (Exception ex)
    //                 {
    //                     logger.LogError(ex, "Failed to create sync events for message {MessageId}", response.Id);
    //                 }
    //             });
    //         }
    //     }
    //     else
    //     {
    //         response = await CreateAndSaveMessageFast(senderId, dto, conversation);
    //     }
    //
    //     return response;
    // }


    // // Her henter vi meldinger etter ConversationId
    // public async Task<List<EncryptedMessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int userId,
    // int skip = 0, int take = 20)
    // {
    //     // Samme tilgangskontroll logikk som før
    //     bool canSend = await msgCache.CanUserSendAsync(userId, conversationId);
    //     bool isCreator = await context.Conversations
    //         .AsNoTracking()
    //         .AnyAsync(c => c.Id == conversationId && c.CreatorId == userId);
    //
    //     if (canSend || isCreator)
    //     {
    //         return await GetFullMessagesAsync(conversationId, skip, take);
    //     }
    //
    //     // Samme membership sjekk som før...
    //     var conversation = await context.Conversations
    //         .AsNoTracking()
    //         .Include(c => c.Participants)
    //         .FirstOrDefaultAsync(c => c.Id == conversationId);
    //
    //     if (conversation == null)
    //         throw new Exception("Samtalen finnes ikke.");
    //
    //     var userParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
    //
    //     if (userParticipant == null) 
    //         throw new UnauthorizedAccessException("Du har ikke tilgang til denne samtalen.");
    //     
    //     if (userParticipant.ConversationArchived)
    //         throw new UnauthorizedAccessException("You have deleted this conversation. Restore it to regain access.");
    //
    //     if (conversation.IsGroup)
    //         return await GetFullMessagesAsync(conversationId, skip, take);
    //
    //     return await GetLimitedMessagesPreviewFor1v1(conversation, userId, take);
    // }
    //
    // // 🔒 Spesialisert metode for 1-1 pending samtaler
    // private async Task<List<EncryptedMessageResponseDTO>> GetLimitedMessagesPreviewFor1v1(Conversation conversation, int userId, int take)
    // {
    //     if (conversation.IsApproved)
    //     {
    //         // Samtale er godkjent men bruker ikke i CanSend? Rare edge case
    //         return await GetFullMessagesAsync(conversation.Id, 0, take);
    //     }
    //
    //     var otherUserId = conversation.Participants.First(p => p.UserId != userId).UserId;
    //     bool isCreator = userId == conversation.CreatorId;
    //
    //     if (isCreator)
    //     {
    //         // Creator ser alt
    //         return await GetFullMessagesAsync(conversation.Id, 0, take);
    //     }
    //
    //     // Ikke-creator: begrenset preview (maks 5 fra sender + egne)
    //     var allMessages = await context.Messages // Endret fra Messages til EncryptedMessages
    //         .AsNoTracking()
    //         .Where(m => m.ConversationId == conversation.Id && 
    //                     (m.SenderId == userId || m.SenderId == otherUserId))
    //         .Include(m => m.Attachments) // Endret fra Attachments til Attachments
    //         .Include(m => m.Reactions)
    //         .Include(m => m.Sender).ThenInclude(u => u.UserProfile)
    //         // ParentMessage støttes ikke for encrypted messages ennå, eller du må legge til navigation property
    //         .OrderByDescending(m => m.SentAt)
    //         .ToListAsync();
    //
    //     var ownMessages = allMessages.Where(m => m.SenderId == userId).Take(take);
    //     var otherMessages = allMessages.Where(m => m.SenderId == otherUserId).Take(5);
    //
    //     var combined = ownMessages.Concat(otherMessages)
    //         .OrderByDescending(m => m.SentAt)
    //         .ToList();
    //
    //     return combined.Select(MapMessageToResponseDTO).ToList(); // Bruker den nye mapping-metoden
    // }
    //
    //
    // private async Task<List<EncryptedMessageResponseDTO>> GetFullMessagesAsync(int conversationId, int skip, int take)
    // {
    //     var messages = await context.Messages
    //         .AsNoTracking()
    //         .Where(m => m.ConversationId == conversationId)
    //         .Include(m => m.Attachments)
    //         .Include(m => m.Reactions)
    //         .Include(m => m.Sender).ThenInclude(u => u.UserProfile)
    //         .OrderByDescending(m => m.SentAt)
    //         .Skip(skip)
    //         .Take(take)
    //         .ToListAsync();
    //
    //     return messages.Select(MapMessageToResponseDTO).ToList();
    // }
    //
    // private EncryptedMessageResponseDTO MapMessageToResponseDTO(EncryptedMessage message)
    // {
    //     Console.WriteLine($"🔐🐛 MAPPING MESSAGE {message.Id}: KeyInfoKeys={JsonConvert.DeserializeObject<Dictionary<string, string>>(message.KeyInfo)?.Keys.Count ?? 0}");
    //     
    //     return new EncryptedMessageResponseDTO
    //     {
    //         Id = message.Id,
    //         SenderId = message.SenderId,
    //         EncryptedText = message.IsDeleted ? null : message.EncryptedText,
    //         KeyInfo = message.IsDeleted ? new Dictionary<string, string>() : 
    //             JsonConvert.DeserializeObject<Dictionary<string, string>>(message.KeyInfo) ?? new Dictionary<string, string>(),
    //         IV = message.IsDeleted ? string.Empty : message.IV,
    //         Version = message.Version,
    //         SentAt = message.SentAt.ToString("O"),
    //         ConversationId = message.ConversationId,
    //         IsDeleted = message.IsDeleted,
    //         ParentMessageId = message.ParentMessageId,
    //         ParentMessagePreview = message.ParentMessagePreview,
    //         IsSystemMessage = message.IsSystemMessage,
    //     
    //         Sender = message.Sender != null ? new UserSummaryDto
    //         {
    //             Id = message.Sender.Id,
    //             FullName = message.Sender.FullName,
    //             ProfileImageUrl = message.Sender.ProfileImageUrl
    //         } : null,
    //
    //         EncryptedAttachments = message.IsDeleted ? new List<EncryptedAttachmentDto>() :
    //             message.Attachments.Select(a => new EncryptedAttachmentDto
    //             {
    //                 EncryptedFileUrl = a.EncryptedFileUrl,
    //                 FileType = a.FileType,
    //                 FileName = a.OriginalFileName,
    //                 FileSize = a.OriginalFileSize,
    //                 KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(a.KeyInfo) ?? new Dictionary<string, string>(),
    //                 IV = a.IV,
    //                 Version = a.Version,
    //                 
    //                 // 🆕 THUMBNAIL FIELDS - Map thumbnail data from database
    //                 EncryptedThumbnailUrl = a.EncryptedThumbnailUrl,
    //                 ThumbnailKeyInfo = !string.IsNullOrEmpty(a.ThumbnailKeyInfo) 
    //                     ? JsonConvert.DeserializeObject<Dictionary<string, string>>(a.ThumbnailKeyInfo) 
    //                     : null,
    //                 ThumbnailIV = a.ThumbnailIV,
    //                 ThumbnailWidth = a.ThumbnailWidth,
    //                 ThumbnailHeight = a.ThumbnailHeight,
    //                 // Note: EncryptedThumbnailData is not included since it's only used during upload
    //             }).ToList(),
    //
    //         Reactions = message.IsDeleted ? new List<ReactionDto>() :
    //             message.Reactions.Select(r => new ReactionDto
    //             {
    //                 MessageId = r.MessageId,
    //                 Emoji = r.Emoji,
    //                 UserId = r.UserId
    //             }).ToList()
    //     };
    // }

    // // Hente alle meldingsforespørsler til en bruker
    // public async Task<PaginatedMessageRequestsDTO> GetPendingMessageRequestsAsync(int receiverId, int page = 1,
    //     int pageSize = 10)
    // {
    //     try
    //     {
    //         // ✅ SEPARATE QUERIES: Hent message requests
    //         var messageRequests = await context.MessageRequests
    //             .AsNoTracking()
    //             .AsSplitQuery()
    //             .Where(r => r.ReceiverId == receiverId && !r.IsAccepted && !r.IsRejected)
    //             .Select(r => new MessageRequestDTO
    //             {
    //                 SenderId = r.SenderId,
    //                 SenderName = r.Sender.FullName,
    //                 ProfileImageUrl = r.Sender.ProfileImageUrl,
    //                 RequestedAt = r.RequestedAt,
    //                 ConversationId = r.ConversationId,
    //                 GroupName = null,
    //                 GroupImageUrl = null,
    //                 IsGroup = false,
    //                 LimitReached = r.LimitReached,
    //                 IsPendingApproval = !r.Conversations.IsApproved,
    //                 Participants = null
    //             })
    //             .ToListAsync();
    //
    //         // ✅ SEPARATE QUERIES: Hent group requests
    //         var groupRequests = await context.GroupRequests
    //             .AsNoTracking()
    //             .AsSplitQuery()
    //             .Where(gr => gr.ReceiverId == receiverId && gr.Status == GroupRequestStatus.Pending)
    //             .Select(gr => new MessageRequestDTO
    //             {
    //                 SenderId = gr.SenderId,
    //                 SenderName = gr.Sender.FullName,
    //                 ProfileImageUrl = gr.Sender.ProfileImageUrl,
    //                 RequestedAt = gr.RequestedAt,
    //                 ConversationId = gr.ConversationId,
    //                 GroupName = gr.Conversations.GroupName,
    //                 GroupImageUrl = gr.Conversations.GroupImageUrl,
    //                 IsGroup = true,
    //                 LimitReached = false,
    //                 IsPendingApproval = true,
    //                 Participants = gr.Conversations.Participants.Select(p => new UserSummaryDto
    //                 {
    //                     Id = p.AppUser.Id,
    //                     FullName = p.AppUser.FullName,
    //                     ProfileImageUrl = p.AppUser.ProfileImageUrl
    //                 }).ToList()
    //             })
    //             .ToListAsync();
    //
    //         // ✅ KOMBINER OG SORTER i minnet
    //         var allRequests = messageRequests
    //             .Concat(groupRequests)
    //             .OrderByDescending(r => r.RequestedAt)
    //             .ToList();
    //
    //         // ✅ PAGINERING i minnet
    //         var totalCount = allRequests.Count;
    //         var pagedRequests = allRequests
    //             .Skip((page - 1) * pageSize)
    //             .Take(pageSize)
    //             .ToList();
    //
    //         var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
    //
    //         return new PaginatedMessageRequestsDTO
    //         {
    //             Requests = pagedRequests,
    //             TotalCount = totalCount,
    //             Page = page,
    //             PageSize = pageSize,
    //             TotalPages = totalPages,
    //             HasMore = page < totalPages
    //         };
    //     }
    //     catch (Exception ex)
    //     {
    //         logger.LogError(ex, "❌ Failed to get paginated pending message requests for appUser {UserId}", receiverId);
    //         throw;
    //     }
    // }


    // // Her henter vi og ser meldinger etter vi har godtkjent en meldingsforespørsel
    // public async Task ApproveMessageRequestAsync(int receiverId, int conversationId)
    // {
    //     // Sjekk først hvilken type samtale det er
    //     var conversation = await context.Conversations
    //         .Include(c => c.Participants)
    //             .ThenInclude(p => p.AppUser)
    //                 .ThenInclude(u => u.UserProfile) //  Inkluder AppUser og UserProfile data
    //         .FirstOrDefaultAsync(c => c.Id == conversationId);
    //
    //     if (conversation == null)
    //         throw new Exception("The conversation does not exist.");
    //
    //     bool isGroupRequest = conversation.IsGroup;
    //     int senderId; // Definer senderId her
    //
    //     if (isGroupRequest)
    //     {
    //         //  Håndter GroupRequest
    //         var groupRequest = await context.GroupRequests
    //             .FirstOrDefaultAsync(gr => gr.ReceiverId == receiverId && 
    //                                       gr.ConversationId == conversationId && 
    //                                       gr.Status == GroupRequestStatus.Pending);
    //
    //         if (groupRequest == null)
    //             throw new Exception("Gruppeforespørselen finnes ikke eller er allerede behandlet.");
    //
    //         groupRequest.Status = GroupRequestStatus.Approved;
    //         senderId = groupRequest.SenderId; // Lagre senderId
    //
    //         // Legg til brukeren som participant i gruppen
    //         var existingParticipant = await context.ConversationParticipants
    //             .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == receiverId);
    //
    //         if (!existingParticipant)
    //         {
    //             context.ConversationParticipants.Add(new ConversationParticipant
    //             {
    //                 ConversationId = conversationId,
    //                 UserId = receiverId
    //             });
    //         }
    //         
    //         await context.AddCanSendAsync(receiverId, conversationId, msgCache, CanSendReason.GroupRequest);
    //         
    //     }
    //     else
    //     {
    //         // Håndter MessageRequest
    //         var messageRequest = await context.MessageRequests
    //             .FirstOrDefaultAsync(r => r.ReceiverId == receiverId && 
    //                                       r.ConversationId == conversationId &&
    //                                       !r.IsAccepted); 
    //
    //         if (messageRequest == null)
    //             throw new Exception("Meldingsforespørselen finnes ikke eller er allerede behandlet.");
    //
    //         // ALLTID godkjenn uansett om avsender har slettet
    //         messageRequest.IsAccepted = true;
    //         messageRequest.IsRejected = false;
    //         senderId = messageRequest.SenderId;
    //
    //         // ALLTID marker samtalen som godkjent
    //         conversation.IsApproved = true;
    //     
    //         // Sjekk om avsender har slettet - kun for CanSend-beslutning
    //         var senderHasDeleted = await context.ConversationParticipants
    //             .AsNoTracking()
    //             .AnyAsync(p => p.ConversationId == conversationId && 
    //                            p.UserId == senderId && 
    //                            p.ConversationArchived);
    //
    //         // 🎯 Legg til CanSend kun hvis avsender ikke har slettet
    //         if (!senderHasDeleted)
    //         {
    //             await context.AddCanSendAsync(receiverId, conversationId, msgCache, CanSendReason.MessageRequest);
    //             await context.AddCanSendAsync(senderId, conversationId, msgCache, CanSendReason.MessageRequest);
    //         }
    //         // Hvis avsender har slettet: godkjenning skjer, men ingen CanSend
    //     }
    //     
    //     await context.SaveChangesAsync();
    //     // Bygg conversation sync data ETTER SaveChanges (når all data er oppdatert)
    //     var userIds = conversation.Participants.Select(p => p.UserId).ToArray();
    //
    //     // 🆕 Hent userData hvis ikke allerede loaded
    //     Dictionary<int, (string FullName, string? ProfileImageUrl)> userData;
    //     bool hasUserData = conversation.Participants?.Any(p => p.AppUser != null) == true;
    //     
    //     if (hasUserData)
    //     {
    //         // Bruk existing appUser data fra Include
    //         userData = conversation.Participants.ToDictionary(
    //             p => p.UserId,
    //             p => (p.AppUser.FullName, p.AppUser.ProfileImageUrl)
    //         );
    //     }
    //     else
    //     {
    //         // Hent userData fra database
    //         userData = await SyncEventExtensions.GetUserDataAsync(context, userIds);
    //     }
    //     
    //     // Hent group request statuses for groups
    //     Dictionary<int, string>? groupRequestStatuses = null;
    //     if (conversation.IsGroup)
    //     {
    //         groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
    //             context, conversationId, userIds);
    //     }
    //
    //     //  Bygg conversation sync data med group statuses
    //     var conversationSyncData = conversation.MapConversationToSyncData(
    //         receiverId, 
    //         userData, 
    //         groupRequestStatuses
    //     );
    //
    //     
    //     // Hent brukeren som godkjenner
    //     var approver = await context.AppUsers
    //                        .FirstOrDefaultAsync(u => u.Id == receiverId)
    //                    ?? throw new Exception("Godkjenneren ble ikke funnet.");
    //
    //     // Send automatisk melding
    //     var systemMessageText = isGroupRequest
    //         ? $"{approver.FullName} has joined the group."
    //         : $"{approver.FullName} has accepted the conversation.";
    //
    //     var systemMessage = await messageNotificationService.CreateSystemMessageAsync(conversationId, systemMessageText);
    //
    //     if (isGroupRequest)
    //     {
    //         using var scope = scopeFactory.CreateScope();
    //         var groupNotifSvc = scope.ServiceProvider.GetRequiredService<GroupNotificationService>();
    //     
    //         //  Opprett GroupEvent for MemberAccepted - dette vil automatisk:
    //         // - Opprette GroupEvent
    //         // - Oppdatere GroupNotifications for alle godkjente medlemmer
    //         // - Sende SendGroupNotificationUpdatesAsync til alle godkjente medlemmer
    //         await groupNotifSvc.CreateGroupEventAsync(
    //             GroupEventType.MemberAccepted,
    //             conversationId,
    //             receiverId, // receiverId er den som aksepterte
    //             new List<int> { receiverId } // affected appUser er den som aksepterte
    //         );
    //     }
    //     else
    //     {
    //         // Håndter MessageRequest som før
    //         var notification = await messageNotificationService.CreateMessageRequestApprovedNotificationAsync(
    //             receiverId, senderId, conversationId);
    //
    //         await hubContext.Clients.User(senderId.ToString())
    //             .SendAsync("MessageRequestApproved", notification);
    //     }
    //     
    //     // SYNC EVENTS - etter SaveChanges når alle IDer er tilgjengelige
    //     taskQueue.QueueAsync(async () => 
    //     {
    //         using var scope = scopeFactory.CreateScope();
    //         var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
    //
    //         try 
    //         {
    //             if (isGroupRequest)
    //             {
    //                 // Sync event for group request approval
    //                 await syncService.CreateAndDistributeSyncEventAsync(
    //                     eventType: SyncEventTypes.GROUP_INFO_UPDATED,
    //                     eventData: new {
    //                         conversation = conversationSyncData, // Match andre events
    //                         systemMessage
    //                     }, // Kun samtale-data, ikke ekstra wrapper
    //                     targetUserIds: conversation.Participants.Select(p => p.UserId),
    //                     source: "API",
    //                     relatedEntityId: conversationId,
    //                     relatedEntityType: "GroupRequest"
    //                 );
    //             }
    //             else
    //             {
    //                 // Bruk CONVERSATION_CREATED for begge parter i 1-1 samtaler
    //                 var bothUserIds = new[] { senderId, receiverId };
    //             
    //                 await syncService.CreateAndDistributeSyncEventAsync(
    //                     eventType: SyncEventTypes.CONVERSATION_CREATED,
    //                     eventData: new {
    //                         conversation = conversationSyncData, 
    //                         systemMessage
    //                     },
    //                     targetUserIds: bothUserIds, // Begge får samme event
    //                     source: "API",
    //                     relatedEntityId: conversationId,
    //                     relatedEntityType: "MessageRequest"
    //                 );
    //             }
    //         }
    //         catch (Exception ex)
    //         {
    //             logger.LogError(ex, "Failed to create sync event for request approval. ConversationId: {ConversationId}, IsGroup: {IsGroup}", 
    //                 conversationId, isGroupRequest);
    //         }
    //     });
    // }

    // // Søke etter meldinger til en samtale
    // public async Task<List<MessageResponseDTO>> SearchMessagesInConversationAsync(int conversationId, int userId,
    //     string query, int skip = 0, int take = 50)
    // {
    //     // Samme tilgangssjekk som før...
    //     bool canSend = await msgCache.CanUserSendAsync(userId, conversationId);
    //     bool isCreator = await context.Conversations
    //         .AsNoTracking()
    //         .AnyAsync(c => c.Id == conversationId && c.CreatorId == userId);
    //
    //     if (!canSend && !isCreator)
    //     {
    //         throw new UnauthorizedAccessException("Du har ikke tilgang til å søke i denne samtalen.");
    //     }
    //
    //     var messages = await context.Messages
    //         .AsNoTracking()
    //         .Where(m => m.ConversationId == conversationId &&
    //                     !m.IsDeleted &&
    //                     (
    //                         (m.EncryptedText != null && EF.Functions.ILike(m.EncryptedText, $"%{query}%")) ||
    //                         m.Attachments.Any(a =>
    //                             (a.OriginalFileName != null && EF.Functions.ILike(a.OriginalFileName, $"%{query}%")) ||
    //                             EF.Functions.ILike(a.FileType, $"%{query}%")
    //                         )
    //                     ))
    //         .OrderByDescending(m => m.SentAt)
    //         .Skip(skip)
    //         .Take(take)
    //         .Select(m => new MessageResponseDTO
    //         {
    //             Id = m.Id,
    //             SenderId = m.SenderId,
    //             Text = m.EncryptedText, // Endret fra m.Text
    //             SentAt = m.SentAt,
    //             ConversationId = m.ConversationId,
    //             IsSystemMessage = m.IsSystemMessage,
    //             IsDeleted = m.IsDeleted,
    //             
    //             Sender = m.Sender != null ? new UserSummaryDto
    //             {
    //                 Id = m.Sender.Id,
    //                 FullName = m.Sender.FullName,
    //                 ProfileImageUrl = m.Sender.ProfileImageUrl
    //             } : null,
    //             
    //             Attachments = m.Attachments
    //                 .Where(a => !string.IsNullOrWhiteSpace(a.EncryptedFileUrl)) // Endret fra a.FileUrl
    //                 .Select(a => new AttachmentDto
    //                 {
    //                     FileUrl = a.EncryptedFileUrl, // Endret fra a.FileUrl
    //                     FileType = a.FileType,
    //                     FileName = a.OriginalFileName, // Endret fra a.FileName
    //                     FileSize = a.OriginalFileSize  // Legg til hvis AttachmentDto har FileSize
    //                 }).ToList(),
    //                 
    //             Reactions = m.Reactions.Select(r => new ReactionDto
    //             {
    //                 MessageId = r.MessageId,
    //                 Emoji = r.Emoji,
    //                 UserId = r.UserId
    //             }).ToList(),
    //             
    //             ParentMessageId = m.ParentMessageId,
    //             ParentMessageText = m.ParentMessage != null ? m.ParentMessage.EncryptedText : null, // Endret fra m.ParentMessage.Text
    //             ParentSender = m.ParentMessage != null && m.ParentMessage.Sender != null ? new UserSummaryDto
    //             {
    //                 Id = m.ParentMessage.Sender.Id,
    //                 FullName = m.ParentMessage.Sender.FullName,
    //                 ProfileImageUrl = m.ParentMessage.Sender.ProfileImageUrl
    //             } : null
    //         })
    //         .ToListAsync();
    //
    //     return messages;
    // }
    
    //
    // // Slette meldinger
    // public async Task<MessageResponseDTO> SoftDeleteMessageAsync(int messageId, int userId)
    // {
    //     var message = await context.Messages
    //         .Include(m => m.Conversation)
    //         .ThenInclude(c => c.Participants)
    //         .FirstOrDefaultAsync(m => m.Id == messageId);
    //
    //     if (message == null)
    //         throw new Exception("Message not found.");
    //
    //     // 🔒 Autorisation: Kun avsender kan slette sin egen melding
    //     if (message.SenderId != userId)
    //         throw new UnauthorizedAccessException("You can only delete your own messages.");
    //     
    //
    //     // ✅ Soft delete
    //     message.IsDeleted = true;
    //
    //     // 🗂️ Fjern vedlegg 
    //     message.Attachments.Clear();
    //
    //     await context.SaveChangesAsync();
    //
    //     // 📤 Hent oppdatert melding via optimalisert metode
    //     var response = await MapToResponseDtoOptimized(messageId); // Pass messageId, ikke message objekt
    //
    //     // Hent participants for SignalR broadcast
    //     var participantIds = message.Conversation.Participants
    //         .Select(p => p.UserId)
    //         .ToArray();
    //
    //     // Send til alle deltakere
    //     taskQueue.QueueAsync(() => NotifyMessageDeleted(
    //         conversationId: message.ConversationId,
    //         participantIds: participantIds,
    //         deletedMessage: response
    //     ));
    //     
    //     taskQueue.QueueAsync(async () => 
    //     {
    //         // Først SignalR (for øyeblikkelig UI oppdatering)
    //         await NotifyMessageDeleted(
    //             conversationId: message.ConversationId,
    //             participantIds: participantIds,
    //             deletedMessage: response
    //         );
    //
    //         // Så Sync Event (for offline/bootstrap sync)
    //         using var scope = scopeFactory.CreateScope();
    //         var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
    //
    //         try 
    //         {
    //             await syncService.CreateAndDistributeSyncEventAsync(
    //                 eventType: SyncEventTypes.MESSAGE_DELETED,
    //                 eventData: new { 
    //                     messageId = messageId,
    //                     conversationId = message.ConversationId
    //                 },
    //                 targetUserIds: participantIds.ToList(),
    //                 source: "API",
    //                 relatedEntityId: messageId,
    //                 relatedEntityType: "Message"
    //             );
    //         }
    //         catch (Exception ex)
    //         {
    //             logger.LogError(ex, "Failed to create sync event for message deletion. MessageId: {MessageId}", messageId);
    //         }
    //     });
    //
    //     return response;
    // }
    //
    // // 3. SignalR notification metode
    // private async Task NotifyMessageDeleted(
    //     int conversationId,
    //     int[] participantIds,
    //     MessageResponseDTO deletedMessage)
    // {
    //     var signalrTasks = participantIds.Select(async uid =>
    //     {
    //         try
    //         {
    //             await hubContext.Clients.User(uid.ToString())
    //                 .SendAsync("MessageDeleted", new { 
    //                     conversationId = conversationId,
    //                     message = deletedMessage 
    //                 });
    //         }
    //         catch (Exception ex)
    //         {
    //             logger.LogWarning(ex, "Failed to send deleted message notification to appUser {UserId}", uid);
    //         }
    //     });
    //
    //     await Task.WhenAll(signalrTasks);
    // }
    
    
    
    
    
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    
   //  // Hjelpemetoder til SendMessage
   //  // 1. Kombinert bruker-sjekk – 1 query i stedet for 2.
   //  private async Task CheckUsersExistAsync(int senderId, int receiverId)
   //  {
   //      var usersExist = await context.AppUsers
   //          .AsNoTracking()
   //          .Where(u => u.Id == senderId || u.Id == receiverId)
   //          .Select(u => u.Id)
   //          .ToListAsync();
   //
   //      if (!usersExist.Contains(senderId)) throw new Exception("Sender finnes ikke.");
   //      if (!usersExist.Contains(receiverId)) throw new Exception("Mottaker finnes ikke.");
   //  }
   //
   //  // 3. GetOrCreate uten ekstra SaveChanges når samtalen finnes
   //  private async Task<(Conversations conv, int? receiverId)> GetOrCreateConversationFast(
   //      int senderId, SendMessageRequestDTO dto)
   //  {
   //      if (dto.ConversationId > 0)
   //      {
   //          var conv = await context.Conversations
   //              .Include(c => c.Participants)
   //              .FirstOrDefaultAsync(c => c.Id == dto.ConversationId);
   //
   //          if (conv == null)
   //              throw new Exception("Samtalen finnes ikke.");
   //
   //          if (conv.Participants.All(p => p.UserId != senderId))
   //              throw new Exception("Du er ikke medlem av denne samtalen.");
   //
   //          if (conv.IsGroup)
   //              return (conv, null);
   //
   //          int receiverId = conv.Participants.First(p => p.UserId != senderId).UserId;
   //
   //          if (senderId == receiverId)
   //              throw new Exception("Du kan ikke sende en melding til deg selv.");
   //
   //          return (conv, receiverId);
   //      }
   //
   //      if (!int.TryParse(dto.ReceiverId, out var recId))
   //          throw new Exception("Ugyldig mottaker-ID.");
   //
   //      await CheckUsersExistAsync(senderId, recId);
   //
   //      var existing = await context.Conversations
   //          .Include(c => c.Participants)
   //              .ThenInclude(p => p.AppUser)               // ← LEGG TIL DISSE
   //              .ThenInclude(u => u.UserProfile)  
   //          .FirstOrDefaultAsync(c =>
   //              !c.IsGroup &&
   //              c.Participants.Count == 2 &&
   //              c.Participants.Any(p => p.UserId == senderId) &&
   //              c.Participants.Any(p => p.UserId == recId));
   //
   //      if (existing != null)
   //          return (existing, recId);
   //      
   //
   //      var convNew = new Conversations
   //      {
   //          IsGroup = false,
   //          CreatorId = senderId,
   //          Participants = new List<ConversationParticipant>
   //          {
   //              new() { UserId = senderId },
   //              new() { UserId = recId }
   //          }
   //      };
   //
   //      context.Conversations.Add(convNew);
   //      return (convNew, recId);
   //  }
   //
   //  // 4. Rask approval-sjekk – tar inn Conversations-objektet
   //  private async Task<(bool requiresApproval, bool isRejected, bool requestSent)> ShouldRequireApprovalFast(
   //      int senderId, int receiverId, Conversations conv)
   //  {
   //      if (conv.IsGroup)
   //      {
   //          // 🆕 Sjekk GroupRequest i stedet for MessageRequest
   //          bool hasApprovedGroupRequest = await context.GroupRequests.AsNoTracking()
   //              .AnyAsync(gr => gr.ConversationId == conv.Id &&
   //                              gr.ReceiverId == senderId &&
   //                              gr.Status == GroupRequestStatus.Approved);
   //      
   //          // 🆕 Eller sjekk om brukeren er creator av gruppen
   //          bool isCreator = conv.CreatorId == senderId;
   //      
   //          // Ikke krev approval hvis bruker har godkjent GroupRequest ELLER er creator
   //          return (!(hasApprovedGroupRequest || isCreator), false, false);
   //      }
   //
   //      if (conv.IsApproved) return (false, false, false);
   //
   //      // 🆕  Bruk cache
   //      bool isFriend = await context.Friends.AsNoTracking()
   //          .AnyAsync(f => (f.UserId == senderId && f.FriendId == receiverId) ||
   //                         (f.UserId == receiverId && f.FriendId == senderId));
   //
   //      // Om de ikke er venner må vi fortsatt sjekke tidligere MessageRequest
   //      var req = await context.MessageRequests.AsNoTracking()
   //          .OrderByDescending(r => r.RequestedAt)
   //          .FirstOrDefaultAsync(r =>
   //              r.ConversationId == conv.Id &&
   //              ((r.SenderId == senderId && r.ReceiverId == receiverId) ||
   //               (r.SenderId == receiverId && r.ReceiverId == senderId)));
   //
   //      if (isFriend || req?.IsAccepted == true)
   //          return (false, false, false);
   //
   //
   //      bool isRejected = req?.IsRejected == true;
   //      bool requestSent = req?.SenderId == senderId;
   //
   //      return (true, isRejected, requestSent);
   //  }
   //
   //  // 5. Legg bare til en entity – ingen SaveChanges her
   //  private bool AddMessageRequestEntityIfMissing(int senderId, int? receiverId, Conversations conv)
   //  {
   //      bool exists = context.MessageRequests.Local
   //                        .Any(r => r.ConversationId == conv.Id &&
   //                                  ((r.SenderId == senderId && r.ReceiverId == receiverId) ||
   //                                   (r.SenderId == receiverId && r.ReceiverId == senderId)))
   //                    ||
   //                    context.MessageRequests
   //                        .AsNoTracking()
   //                        .Any(r => r.ConversationId == conv.Id &&
   //                                  ((r.SenderId == senderId && r.ReceiverId == receiverId) ||
   //                                   (r.SenderId == receiverId && r.ReceiverId == senderId)));
   //
   //      if (exists) return false; // 🆕 Ingen ny request opprettet
   //
   //      context.MessageRequests.Add(new MessageRequest
   //      {
   //          SenderId = senderId,
   //          ReceiverId = receiverId.Value,
   //          Conversations = conv
   //      });
   //
   //      return true; // 🆕 Ny request opprettet
   //  }
   //
   //  // 6. Limit-reached markeres, men vi committer senere
   //  private void MarkLimitReached(int senderId, int? receiverId, int convId)
   //  {
   //      var req = context.MessageRequests
   //          .FirstOrDefault(r =>
   //              (r.SenderId == senderId && r.ReceiverId == receiverId) ||
   //              (r.SenderId == receiverId && r.ReceiverId == senderId));
   //
   //      if (req != null) req.LimitReached = true;
   //  }
   //
   //
   //  public Message CreateMessage(int senderId, int conversationId, SendMessageRequestDTO request, bool isApproved)
   //  {
   //      return new Message
   //      {
   //          SenderId = senderId,
   //          ConversationId = conversationId,
   //          EncryptedText = request.Text,
   //          SentAt = DateTime.UtcNow,
   //          ParentMessageId = request.ParentMessageId > 0 ? request.ParentMessageId : null,
   //          Attachments = request.Attachments?.Select(a => new MessageAttachment
   //          {
   //              EncryptedFileUrl = a.FileUrl, // Endret fra FileUrl
   //              FileType = a.FileType,
   //              OriginalFileName = a.FileName, // Endret fra FileName
   //              OriginalFileSize = a.FileSize ?? 0, // Endret fra FileSize
   //          
   //              // Du må også sette de påkrevde krypterte feltene:
   //              KeyInfo = "{}", // Sett til tom JSON hvis ikke kryptert her
   //              IV = string.Empty, // Sett til tom hvis ikke kryptert her
   //              Version = 1
   //          }).ToList() ?? new List<MessageAttachment>()
   //      };
   //  }
   //
   //  public async Task<MessageResponseDTO> MapToResponseDtoOptimized(int messageId)
   //  {
   //      var dto = await context.Messages
   //          .AsNoTracking()
   //          .AsSplitQuery()
   //          .Where(m => m.Id == messageId)
   //          .Select(m => new MessageResponseDTO
   //          {
   //              Id = m.Id,
   //              SenderId = m.SenderId,
   //              Text = m.IsDeleted ? null : m.EncryptedText, // Allerede oppdatert
   //              SentAt = m.SentAt,
   //              ConversationId = m.ConversationId,
   //              IsDeleted = m.IsDeleted, 
   //              ParentMessageId = m.IsDeleted ? null : m.ParentMessageId, 
   //              ParentMessageText = m.IsDeleted ? null : 
   //                  (m.ParentMessage != null ? m.ParentMessage.EncryptedText : null), // Allerede oppdatert
   //
   //              Sender = m.Sender != null ? new UserSummaryDto
   //              {
   //                  Id = m.Sender.Id,
   //                  FullName = m.Sender.FullName,
   //                  ProfileImageUrl = m.Sender.ProfileImageUrl
   //              } : null,
   //
   //              ParentSender = m.IsDeleted ? null : 
   //                  (m.ParentMessage != null && m.ParentMessage.Sender != null
   //                      ? new UserSummaryDto
   //                      {
   //                          Id = m.ParentMessage.Sender.Id,
   //                          FullName = m.ParentMessage.Sender.FullName,
   //                          ProfileImageUrl = m.ParentMessage.Sender.ProfileImageUrl
   //                      }
   //                      : null),
   //
   //              Attachments = m.IsDeleted ? new List<AttachmentDto>() :
   //                  m.Attachments
   //                      .Select(a => new AttachmentDto
   //                      {
   //                          FileUrl = a.EncryptedFileUrl, // Endret fra a.FileUrl
   //                          FileType = a.FileType,
   //                          FileName = a.OriginalFileName, // Endret fra a.FileName
   //                          FileSize = a.OriginalFileSize // Endret fra a.FileSize
   //                      })
   //                      .ToList(),
   //
   //              Reactions = m.IsDeleted ? new List<ReactionDTO>() :
   //                  m.Reactions
   //                      .Select(r => new ReactionDTO
   //                      {
   //                          MessageId = r.MessageId,
   //                          Emoji = r.Emoji,
   //                          UserId = r.UserId
   //                      })
   //                  .ToList()
   //          })
   //          .SingleOrDefaultAsync();
   //
   //      if (dto is null)
   //          throw new Exception("Message not found");
   //
   //      return dto;
   //  }
   //
   // private async Task NotifyAndBroadcastAsync(
   //  int conversationId,
   //  bool isGroup,
   //  string? groupName,
   //  string? groupImageUrl,
   //  int[] participantIds,
   //  int senderId,
   //  int? receiverId,
   //  MessageResponseDTO response,
   //  bool shouldSendSignalR = true,
   //  bool shouldCreateNotifications = true,
   //  bool needsMessageRequestNotification = false,
   //  bool isRejectedSender = false)
   //  {
   //      using var scope = scopeFactory.CreateScope();
   //      var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
   //      
   //      /* 1. Send over SignalR med per-bruker isSilent */
   //      
   //      var approvedUsers = new HashSet<int>();
   //      int? creatorId = null;
   //      
   //      if (shouldSendSignalR)
   //      {
   //          if (isGroup)
   //          {
   //              // Hent både approved users og creator i én gang
   //              var approvedUsersList = await context.GroupRequests
   //                  .Where(gr => gr.ConversationId == conversationId && 
   //                               participantIds.Contains(gr.ReceiverId) &&
   //                               gr.Status == GroupRequestStatus.Approved)
   //                  .Select(gr => gr.ReceiverId)
   //                  .ToListAsync();
   //      
   //              approvedUsers = approvedUsersList.ToHashSet();
   //                  
   //              creatorId = await context.Conversations
   //                  .Where(c => c.Id == conversationId)
   //                  .Select(c => c.CreatorId)
   //                  .FirstOrDefaultAsync();
   //          }
   //
   //          var signalrTasks = participantIds.Select(async uid =>
   //          {
   //              try
   //              {
   //                  // 🆕 Beregn isSilent per bruker
   //                  bool userIsSilent = false;
   //                  if (isGroup)
   //                  {
   //                      bool isCreator = uid == creatorId;
   //                      bool hasApproved = approvedUsers.Contains(uid);
   //                      
   //                      // Silent hvis ikke creator og ikke approved
   //                      userIsSilent = !isCreator && !hasApproved;
   //                  }
   //
   //                  // 🆕 Opprett kopi av response med bruker-spesifikk isSilent
   //                  var userResponse = new MessageResponseDTO
   //                  {
   //                      Id = response.Id,
   //                      SenderId = response.SenderId,
   //                      Sender = response.Sender,
   //                      Text = response.Text,
   //                      SentAt = response.SentAt,
   //                      ConversationId = response.ConversationId,
   //                      IsSilent = userIsSilent, // 🆕 Per-bruker silent
   //                      Attachments = response.Attachments,
   //                      Reactions = response.Reactions,
   //                      ParentMessageId = response.ParentMessageId,
   //                      ParentMessageText = response.ParentMessageText,
   //                      IsNowApproved = response.IsNowApproved,
   //                      IsRejectedRequest = response.IsRejectedRequest,
   //                      ParentSender = response.ParentSender
   //                  };
   //
   //                  await hubContext.Clients.AppUser(uid.ToString())
   //                      .SendAsync("ReceiveMessage", userResponse);
   //              }
   //              catch (Exception ex)
   //              {
   //                  logger.LogWarning(ex, "Failed to send message to appUser {UserId}", uid);
   //              }
   //          });
   //
   //          await Task.WhenAll(signalrTasks);
   //      }
   //      else if (isRejectedSender)
   //      {
   //          await hubContext.Clients.AppUser(senderId.ToString())
   //              .SendAsync("ReceiveMessage", response);
   //      }
   //      
   //      var notifSvc = scope.ServiceProvider.GetRequiredService<IMessageNotificationService>();
   //      
   //      
   //      /* 2. MessageRequest notification hvis nødvendig */
   //      if (needsMessageRequestNotification && !isGroup && receiverId.HasValue)
   //      {
   //          var notification = await notifSvc.CreateMessageRequestNotificationAsync(
   //              senderId, receiverId.Value, conversationId);
   //
   //          // Send SignalR for MessageRequest
   //          if (notification != null && notification.Type == NotificationType.MessageRequest)
   //          {
   //              await hubContext.Clients.AppUser(receiverId.Value.ToString()).SendAsync("MessageRequestCreated", new MessageRequestCreatedDto
   //              {
   //                  SenderId = senderId,
   //                  ReceiverId = receiverId.Value,
   //                  ConversationId = conversationId,
   //                  Notification = notification
   //              });
   //          }
   //      }
   //
   //      /* 3. Lag notifications kun for approved users i grupper */
   //      if (!shouldCreateNotifications || isRejectedSender) return;
   //      
   //      foreach (var uid in participantIds)
   //      {
   //          if (uid == senderId) continue;
   //      
   //          // 🆕 For grupper: kun lag notifikasjon hvis bruker har approved
   //          bool shouldCreateNotification = true;
   //          if (isGroup)
   //          {
   //              // Bruk allerede hentet data
   //              bool isCreator = uid == creatorId;
   //              bool hasApproved = approvedUsers.Contains(uid);
   //          
   //              shouldCreateNotification = isCreator || hasApproved;
   //          }
   //      
   //          if (shouldCreateNotification)
   //          {
   //              await notifSvc.CreateMessageNotificationAsync(
   //                  recipientUserId: uid,
   //                  senderUserId: senderId, 
   //                  conversationId: conversationId,
   //                  messageId: response.Id);
   //          }
   //      }
   //  }
   //
   //  // 🚀 RASK VALIDERING for eksisterende samtaler
   //  private async Task<(bool CanSend, Conversations Conversations)> ValidateExistingConversationFast(int senderId, int conversationId)
   //  {
   //      // 1. Sjekk cache først (lynraskt) - dette garanterer membership!
   //      bool canSend = await msgCache.CanUserSendAsync(senderId, conversationId);
   //  
   //      if (canSend)
   //      {
   //          // 2. Hent minimal conversation data (kun det vi trenger)
   //          var conversation = await context.Conversations
   //              .AsNoTracking()
   //              .Select(c => new Conversations
   //              {
   //                  Id = c.Id,
   //                  IsGroup = c.IsGroup,
   //                  IsApproved = c.IsApproved,
   //                  CreatorId = c.CreatorId,
   //                  GroupName = c.GroupName,
   //                  GroupImageUrl = c.GroupImageUrl,
   //                  LastMessageSentAt = c.LastMessageSentAt,
   //                  IsDisbanded = c.IsDisbanded
   //              })
   //              .FirstOrDefaultAsync(c => c.Id == conversationId);
   //
   //          if (conversation == null || conversation.IsDisbanded)
   //              return (false, null!);
   //
   //          // ✅ Ingen membership-sjekk nødvendig - CanSend garanterer dette!
   //          return (true, conversation);
   //      }
   //
   //      return (false, null!);
   //  }
   //  
   //  // 🎯 HYPER-RASK meldingsopprettelse (hopper over det meste)
   //  private async Task<MessageResponseDTO> CreateAndSaveMessageFast(int senderId, SendMessageRequestDTO dto, Conversations conversation)
   //  {
   //      // Opprett melding direkte - vi vet brukeren kan sende
   //      var message = CreateMessage(senderId, conversation.Id, dto, isApproved: true);
   //  
   //      context.Messages.Add(message);
   //  
   //      // 🎯 Intelligent conversation oppdatering
   //      var existingEntry = context.Entry(conversation);
   //      if (existingEntry.State == EntityState.Detached)
   //      {
   //          // Conversations er ikke tracked - attach og marker som modified
   //          context.Conversations.Attach(conversation);
   //          conversation.LastMessageSentAt = message.SentAt;
   //          
   //      }
   //      else
   //      {
   //          // Conversations er allerede tracked - bare oppdater
   //          conversation.LastMessageSentAt = message.SentAt;
   //      }
   //
   //      // Lagre alt i én transaksjon
   //      await context.SaveChangesAsync();
   //  
   //      // Hent respons
   //      var response = await MapToResponseDtoOptimized(message.Id);
   //  
   //      // Hent participants for notifikasjoner
   //      var participantIds = await context.ConversationParticipants
   //          .AsNoTracking()
   //          .Where(cp => cp.ConversationId == conversation.Id)
   //          .Select(cp => cp.UserId)
   //          .ToArrayAsync();
   //      
   //      // Send notifikasjoner
   //      taskQueue.QueueAsync(async () => 
   //      {
   //          // Først SignalR-notifikasjoner
   //          await NotifyAndBroadcastAsync(
   //              conversationId: conversation.Id,
   //              isGroup: conversation.IsGroup,
   //              groupName: conversation.GroupName,
   //              groupImageUrl: conversation.GroupImageUrl,
   //              participantIds: participantIds,
   //              senderId: senderId,
   //              receiverId: null,
   //              response: response);
   //      
   //          // Så sync event med ny scope (ikke-kritisk)
   //          using var scope = scopeFactory.CreateScope();
   //          var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>(); 
   //          var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
   //      
   //          try 
   //          {
   //              // 🆕 Fetch group request statuses if it's a group
   //              Dictionary<int, string>? groupRequestStatuses = null;
   //              if (conversation.IsGroup)
   //              {
   //                  groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
   //                      context, conversation.Id, participantIds);
   //              }
   //
   //              // Build conversation data for sync event (with group statuses)
   //              var conversationSyncData = await SyncEventExtensions.BuildConversationSyncData(
   //                  context, 
   //                  conversation, 
   //                  participantIds,
   //                  groupRequestStatuses // Pass group statuses
   //              );
   //              
   //              await syncService.CreateAndDistributeSyncEventAsync(
   //                  eventType: SyncEventTypes.NEW_MESSAGE,
   //                  eventData: new {
   //                      message = response,
   //                      conversation = conversationSyncData
   //                  },
   //                  targetUserIds: participantIds,
   //                  source: "API",
   //                  relatedEntityId: response.Id,
   //                  relatedEntityType: "Message"
   //              );
   //          }
   //          catch (Exception ex)
   //          {
   //              logger.LogError(ex, "Failed to create sync event for message {MessageId}", response.Id);
   //              // Ikke krasj - sync event er ikke kritisk
   //          }
   //      });
   //  
   //      return response;
   //  }

    // // Hjelpemetode for å hente eksisterende samtale
    // private async Task<(Conversation conv, int? receiverId)> GetExistingConversation(int senderId, int conversationId)
    // {
    //     var conv = await context.Conversations
    //         .Include(c => c.Participants)
    //         .FirstOrDefaultAsync(c => c.Id == conversationId);
    //
    //     if (conv == null)
    //         throw new Exception("Samtalen finnes ikke.");
    //
    //     if (conv.Participants.All(p => p.UserId != senderId))
    //         throw new Exception("Du er ikke medlem av denne samtalen.");
    //
    //     if (conv.IsGroup)
    //         return (conv, null);
    //
    //     int receiverId = conv.Participants.First(p => p.UserId != senderId).UserId;
    //     return (conv, receiverId);
    // }
       
    // //////////////////////////////////////////// ENCRYPTED
    // /
    // /
    // /
    // /
    
   //  public async Task<EncryptedMessageResponseDTO> SendEncryptedMessageAsync(int senderId, SendEncryptedMessageRequestDTO dto)
   //  {
   //      if (dto.ReceiverId != null && int.TryParse(dto.ReceiverId, out var rid) && rid == senderId) 
   //          throw new("Du kan ikke sende en melding til deg selv.");
   //      
   //      if (dto.ParentMessageId.HasValue)
   //      {
   //          var parentExists = await context.Messages
   //              .AsNoTracking()
   //              .AnyAsync(m => m.Id == dto.ParentMessageId.Value);
   //      
   //          if (!parentExists)
   //              throw new Exception("Parent message ikke funnet.");
   //      }
   //      
   //      if (dto.ConversationId > 0)
   //      {
   //          var fastValidation = await ValidateExistingConversationFast(senderId, dto.ConversationId.Value);
   //          if (fastValidation.CanSend)
   //          {
   //              // 🎯 HYPER-RASK BANE: Hopp direkte til encrypted meldingsopprettelse
   //              return await CreateAndSaveEncryptedMessageFast(senderId, dto, fastValidation.Conversations);
   //          }
   //      
   //          // Hvis ikke kan sende, fall tilbake til full validering
   //      }
   //      
   //      // Convert to internal DTO format to reuse conversation logic
   //      var internalDto = new SendMessageRequestDTO
   //      {
   //          ConversationId = dto.ConversationId ?? 0,
   //          ReceiverId = dto.ReceiverId,
   //          ParentMessageId = dto.ParentMessageId,
   //          Text = "[Encrypted]" // Placeholder
   //      };
   //      
   //      // 1️⃣ Finn eller lag samtalen (1 query, ingen commit hvis den finnes)
   //      var (conversation, receiverId) = internalDto.ConversationId > 0 
   //          ? await GetExistingConversation(senderId, internalDto.ConversationId)
   //          : await GetOrCreateConversationFast(senderId, internalDto);
   //
   //      Dictionary<int, (string FullName, string? ProfileImageUrl)>? userData = null;
   //
   //      if (internalDto.ConversationId <= 0 && !conversation.IsGroup && receiverId.HasValue)
   //      {
   //          userData = await SyncEventExtensions.GetUserDataAsync(context, senderId, receiverId.Value);
   //      }
   //      
   //      if (!conversation.IsGroup && !receiverId.HasValue)
   //          throw new InvalidOperationException("receiverId skal være satt i 1–1 samtale.");
   //      
   //      // Sjekk cachen om vi kan sende
   //      bool canSend = await msgCache.CanUserSendAsync(senderId, conversation.Id);
   //
   //      EncryptedMessageResponseDTO response;
   //      
   //      if (!canSend)
   //      {
   //          // 2️⃣ Blokkeringssjekk (treffer cache først)
   //          if (!conversation.IsGroup)
   //          {
   //              // 🚀 Hent participants og blocking-data i separate, effektive queries
   //              var participantData = await context.ConversationParticipants
   //                  .AsNoTracking()
   //                  .Where(p => p.ConversationId == conversation.Id && 
   //                              (p.UserId == senderId || p.UserId == receiverId.Value))
   //                  .Select(p => new { p.UserId, p.ConversationArchived })
   //                  .ToListAsync();
   //
   //              var blockedRelations = await context.UserBlocks
   //                  .AsNoTracking()
   //                  .Where(ub =>
   //                      (ub.BlockerId == senderId && ub.BlockedUserId == receiverId.Value) ||
   //                      (ub.BlockerId == receiverId.Value && ub.BlockedUserId == senderId))
   //                  .ToListAsync();
   //
   //              // Rask in-memory prosessering
   //              var senderData = participantData.FirstOrDefault(r => r.UserId == senderId);
   //              var receiverData = participantData.FirstOrDefault(r => r.UserId == receiverId.Value);
   //
   //              bool senderBlockedReceiver = blockedRelations.Any(ub => ub.BlockerId == senderId);
   //              bool receiverBlockedSender = blockedRelations.Any(ub => ub.BlockerId == receiverId.Value);
   //
   //              // Sjekker i riktig rekkefølge
   //              if (receiverData?.ConversationArchived == true || receiverBlockedSender)
   //                  throw new Exception("This appUser has been deleted or is no longer visible, or you lack the required permission to send messages.");
   //
   //              if (senderBlockedReceiver)
   //                  throw new Exception("You can't send messages to an appUser you have blocked.");
   //
   //              if (senderData?.ConversationArchived == true)
   //                  throw new Exception("You cannot send messages to a conversation you have deleted.");
   //          }
   //
   //          // 3️⃣ Må meldingen godkjennes? (3. og evt. 4. query)
   //          bool requiresApproval = false;
   //          bool isRejected = false;
   //          bool requestSent = false;
   //
   //          if (conversation.IsGroup)
   //          {
   //              // For gruppesamtaler: sjekk GroupRequest eller om bruker er creator
   //              bool hasApprovedGroupRequest = await context.GroupRequests.AsNoTracking()
   //                  .AnyAsync(gr => gr.ConversationId == conversation.Id &&
   //                                  gr.ReceiverId == senderId &&
   //                                  gr.Status == GroupRequestStatus.Approved);
   //
   //              bool isCreator = conversation.CreatorId == senderId;
   //
   //              requiresApproval = !(hasApprovedGroupRequest || isCreator);
   //
   //              if (requiresApproval)
   //                  throw new Exception("Du må godkjenne gruppesamtalen før du kan sende meldinger.");
   //          }
   //          else
   //          {
   //              // For 1-1 samtaler: bruk den eksisterende metoden
   //              (requiresApproval, isRejected, requestSent) = await ShouldRequireApprovalFast(
   //                  senderId, receiverId.Value, conversation);
   //
   //              if (requiresApproval)
   //              {
   //                  if (isRejected && !requestSent)
   //                  {
   //                      throw new Exception(
   //                          "You have rejected this message request. Accept it from /Chat to send a message to this appUser.");
   //                  }
   //              }
   //          }
   //
   //          int messageCount = 0;
   //          bool needsMessageRequestNotification = false;
   //
   //          if (!conversation.IsGroup && requiresApproval)
   //          {
   //              // Teller encrypted meldinger **bare** når det trengs
   //              messageCount = await context.Messages.AsNoTracking()
   //                  .CountAsync(m => m.ConversationId == conversation.Id &&
   //                                   m.SenderId == senderId);
   //
   //              if (messageCount >= 5)
   //              {
   //                  MarkLimitReached(senderId, receiverId, conversation.Id);
   //                  await context.SaveChangesAsync();
   //                  throw new Exception(
   //                      "You have reached the limit of messages you can send while waiting for the receiver to accept your request.");
   //              }
   //
   //              // Sjekk om vi trenger å lage ny MessageRequest
   //              needsMessageRequestNotification = AddMessageRequestEntityIfMissing(senderId, receiverId, conversation);
   //          }
   //          else if (!conversation.IsGroup && !conversation.IsApproved)
   //          {
   //              conversation.IsApproved = true;
   //          }
   //
   //          bool nowApproved = false;
   //
   //          // 5️⃣ Lag selve encrypted meldingen
   //          var encryptedMessage = CreateEncryptedMessage(senderId, conversation.Id, dto, !requiresApproval);
   //
   //          if (conversation.Id == 0) // samtalen er ny
   //              encryptedMessage.Conversations = conversation;
   //          else
   //              encryptedMessage.ConversationId = conversation.Id;
   //
   //          context.Messages.Add(encryptedMessage);
   //          conversation.LastMessageSentAt = encryptedMessage.SentAt;
   //
   //          // Handle encrypted attachments
   //          if (dto.EncryptedAttachments?.Any() == true)
   //          {
   //              var attachments = dto.EncryptedAttachments.Select(att => new MessageAttachment
   //              {
   //                  MessageId = encryptedMessage.Id, // Endret fra MessageId
   //                  EncryptedFileUrl = att.EncryptedFileUrl,
   //                  FileType = att.FileType,
   //                  OriginalFileName = att.FileName, // Endret fra FileName til OriginalFileName
   //                  OriginalFileSize = att.FileSize ?? 0, // Endret fra FileSize til OriginalFileSize
   //                  KeyInfo = JsonConvert.SerializeObject(att.KeyInfo),
   //                  IV = att.IV,
   //                  Version = att.Version,
   //                  CreatedAt = DateTime.UtcNow // Legg til CreatedAt
   //              });
   //
   //              context.MessageAttachments.AddRange(attachments);
   //          }
   //
   //          // 6️⃣ ÉN lagring av alt ovenfor
   //          await context.SaveChangesAsync();
   //          
   //          if (!conversation.IsGroup && requiresApproval && !isRejected && !requestSent)
   //          {
   //              var existingRequest = await context.MessageRequests
   //                  .AsNoTracking()
   //                  .AnyAsync(r => r.ConversationId == conversation.Id &&
   //                                 r.ReceiverId == senderId &&
   //                                 !r.IsAccepted && !r.IsRejected);
   //
   //              if (existingRequest)
   //              {
   //                  await ApproveMessageRequestAsync(senderId, conversation.Id);
   //                  
   //                  await context.AddCanSendAsync(senderId, conversation.Id, msgCache, CanSendReason.MessageRequest);
   //                  await context.AddCanSendAsync(receiverId.Value, conversation.Id, msgCache, CanSendReason.MessageRequest);
   //                  
   //                  nowApproved = true;
   //              }
   //          }
   //          else if (!requiresApproval)
   //          {
   //              // 🚨 BACKUP: Dette burde ikke skje ofte
   //              logger.LogWarning("CanSend backup triggered for appUser {SenderId} in conversation {ConversationId}. " +
   //                                 "Consider adding CanSend at the proper time.", senderId, conversation.Id);
   //
   //              await context.AddCanSendAsync(senderId, conversation.Id, msgCache, 
   //                  conversation.IsGroup ? CanSendReason.GroupRequest : CanSendReason.Friendship);
   //          }
   //
   //          // 🆕 Hent encrypted meldingen på nytt med full parent data
   //          response = await MapEncryptedToResponseDtoOptimized(encryptedMessage.Id);
   //
   //          if (nowApproved)
   //          {
   //              response.IsNowApproved = true;
   //          }
   //          
   //          if (isRejected && requestSent)
   //          {
   //              response.IsRejectedRequest = true;
   //          }
   //
   //          var participantIds = conversation.Participants
   //              .Select(p => p.UserId)
   //              .ToArray();
   //
   //          // Rett før køing
   //          var shouldNotify = !requiresApproval || (messageCount > 0 && !isRejected) || nowApproved;
   //          var isRejectedSender = isRejected && requestSent;
   //
   //          // NotifyAndBroadcastAsync for encrypted messages
   //          if (shouldNotify || needsMessageRequestNotification || isRejectedSender)
   //          {
   //              taskQueue.QueueAsync(async () => 
   //              {
   //                  // Først SignalR (send encrypted response)
   //                  await NotifyAndBroadcastEncryptedAsync(
   //                      conversationId: conversation.Id,
   //                      isGroup: conversation.IsGroup,
   //                      groupName: conversation.GroupName,
   //                      groupImageUrl: conversation.GroupImageUrl,
   //                      participantIds: participantIds,
   //                      senderId: senderId,
   //                      receiverId: receiverId,
   //                      response: response,
   //                      shouldSendSignalR: shouldNotify,
   //                      shouldCreateNotifications: shouldNotify,
   //                      needsMessageRequestNotification: needsMessageRequestNotification,
   //                      isRejectedSender: isRejectedSender);
   //      
   //                  // Så sync event med ny scope
   //                  using var scope = scopeFactory.CreateScope();
   //                  var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>();
   //      
   //                  try 
   //                  {
   //                      // Sync event til oppretter av meldingsforespørselen (CONVERSATION_CREATED)
   //                      if (needsMessageRequestNotification && !conversation.IsGroup)
   //                      {
   //                          var conversationData = conversation.MapConversationToSyncData(senderId, userData);
   //      
   //                          await syncService.CreateAndDistributeSyncEventAsync(
   //                              eventType: SyncEventTypes.CONVERSATION_CREATED,
   //                              eventData: new { 
   //                                  conversationData,
   //                                  message = response // Den krypterte meldingen
   //                              },
   //                              singleUserId: senderId,
   //                              source: "API",
   //                              relatedEntityId: conversation.Id,
   //                              relatedEntityType: "Conversations" 
   //                          );
   //                      }
   //
   //                      // Sync event for ny message request (MESSAGE_REQUEST_RECEIVED)
   //                      if (needsMessageRequestNotification && !conversation.IsGroup && receiverId.HasValue)
   //                      {
   //                          var messageRequestData = conversation.MapToRequestDTO(
   //                              senderId: senderId,
   //                              requestedAt: DateTime.UtcNow,
   //                              userData: userData,
   //                              isGroupRequest: false
   //                          );
   //      
   //                          await syncService.CreateAndDistributeSyncEventAsync(
   //                              eventType: SyncEventTypes.REQUEST_RECEIVED,
   //                              eventData: new { 
   //                                  messageRequestData,
   //                                  message = response // Den krypterte meldingen
   //                              },
   //                              singleUserId: receiverId.Value,
   //                              source: "API",
   //                              relatedEntityId: conversation.Id,
   //                              relatedEntityType: "MessageRequest"
   //                          );
   //                      }
   //                      
   //                      Dictionary<int, string>? groupRequestStatuses = null;
   //                      if (conversation.IsGroup)
   //                      {
   //                          groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
   //                              context, conversation.Id, participantIds);
   //                      }
   //
   //                      // Eksisterende NEW_MESSAGE sync event (med encrypted data)
   //                      await syncService.CreateAndDistributeSyncEventAsync(
   //                          eventType: SyncEventTypes.NEW_MESSAGE,
   //                          eventData: new {
   //                              message = response, // Encrypted EncryptedMessageResponseDTO
   //                              conversation = conversation.MapConversationToSyncData(senderId, userData, groupRequestStatuses)
   //                          },
   //                          targetUserIds: participantIds,
   //                          source: "API",
   //                          relatedEntityId: response.Id,
   //                          relatedEntityType: "Message"
   //                      );
   //                  }
   //                  catch (Exception ex)
   //                  {
   //                      logger.LogError(ex, "Failed to create sync events for encrypted message {MessageId}", response.Id);
   //                  }
   //              });
   //          }
   //      }
   //      else
   //      {
   //          response = await CreateAndSaveEncryptedMessageFast(senderId, dto, conversation);
   //      }
   //
   //      return response;
   //  }
   //
   //  // Helper methods for encrypted messages
   //
   //  private EncryptedMessage CreateEncryptedMessage(int senderId, int conversationId, SendEncryptedMessageRequestDTO request, bool isApproved)
   //  {
   //      return new EncryptedMessage
   //      {
   //          SenderId = senderId,
   //          ConversationId = conversationId,
   //          EncryptedText = request.EncryptedText,
   //          KeyInfo = JsonConvert.SerializeObject(request.KeyInfo),
   //          IV = request.IV,
   //          Version = request.Version,
   //          ParentMessageId = request.ParentMessageId > 0 ? request.ParentMessageId : null,
   //          ParentMessagePreview = request.ParentMessagePreview,
   //          SentAt = DateTime.UtcNow,
   //          IsSystemMessage = false,
   //          IsDeleted = false,
   //      };
   //  }
   //
   // private async Task<EncryptedMessageResponseDTO> MapEncryptedToResponseDtoOptimized(int messageId)
   //  {
   //      var dto = await context.Messages
   //          .AsNoTracking()
   //          .AsSplitQuery()
   //          .Where(m => m.Id == messageId)
   //          .Select(m => new EncryptedMessageResponseDTO
   //          {
   //              Id = m.Id,
   //              SenderId = m.SenderId,
   //              EncryptedText = m.IsDeleted ? null : m.EncryptedText,
   //              KeyInfo = m.IsDeleted ? new Dictionary<string, string>() : 
   //                  JsonConvert.DeserializeObject<Dictionary<string, string>>(m.KeyInfo) ?? new Dictionary<string, string>(),
   //              IV = m.IsDeleted ? string.Empty : m.IV,
   //              Version = m.Version,
   //              SentAt = m.SentAt.ToString("O"),
   //              ConversationId = m.ConversationId,
   //              IsDeleted = m.IsDeleted,
   //              ParentMessageId = m.IsDeleted ? null : m.ParentMessageId,
   //              ParentMessagePreview = m.IsDeleted ? null : m.ParentMessagePreview,
   //              IsSystemMessage = m.IsSystemMessage,
   //
   //              Sender = m.Sender != null ? new UserSummaryDto
   //              {
   //                  Id = m.Sender.Id,
   //                  FullName = m.Sender.FullName,
   //                  ProfileImageUrl = m.Sender.ProfileImageUrl
   //              } : null,
   //
   //              ParentSender = m.IsDeleted ? null : 
   //                  (m.ParentMessage != null && m.ParentMessage.Sender != null
   //                      ? new UserSummaryDto
   //                      {
   //                          Id = m.ParentMessage.Sender.Id,
   //                          FullName = m.ParentMessage.Sender.FullName,
   //                          ProfileImageUrl = m.ParentMessage.Sender.ProfileImageUrl
   //                      }
   //                      : null),
   //
   //              EncryptedAttachments = m.IsDeleted ? new List<EncryptedAttachmentDto>() :
   //                  m.Attachments
   //                      .Select(a => new EncryptedAttachmentDto
   //                      {
   //                          EncryptedFileUrl = a.EncryptedFileUrl,
   //                          FileType = a.FileType,
   //                          FileName = a.OriginalFileName, // Endret fra a.FileName
   //                          FileSize = a.OriginalFileSize, // Endret fra a.FileSize
   //                          KeyInfo = JsonConvert.DeserializeObject<Dictionary<string, string>>(a.KeyInfo) ?? new Dictionary<string, string>(),
   //                          IV = a.IV,
   //                          Version = a.Version
   //                      })
   //                      .ToList(),
   //
   //              Reactions = m.IsDeleted ? new List<ReactionDTO>() :
   //                  m.Reactions
   //                      .Select(r => new ReactionDTO
   //                      {
   //                          MessageId = r.MessageId,
   //                          Emoji = r.Emoji,
   //                          UserId = r.UserId
   //                      })
   //                  .ToList()
   //          })
   //          .SingleOrDefaultAsync();
   //
   //      if (dto is null)
   //          throw new Exception("Encrypted message not found");
   //
   //      return dto;
   //  }
   //
   //      private async Task<EncryptedMessageResponseDTO> CreateAndSaveEncryptedMessageFast(int senderId, SendEncryptedMessageRequestDTO dto, Conversations conversation)
   //  {
   //      // Opprett encrypted melding direkte - vi vet brukeren kan sende
   //      var encryptedMessage = CreateEncryptedMessage(senderId, conversation.Id, dto, isApproved: true);
   //
   //      context.Messages.Add(encryptedMessage);
   //
   //      // Handle encrypted attachments
   //      if (dto.EncryptedAttachments?.Any() == true)
   //      {
   //          var attachments = dto.EncryptedAttachments.Select(att => new MessageAttachment
   //          {
   //              MessageId = encryptedMessage.Id, // Endret fra MessageId
   //              EncryptedFileUrl = att.EncryptedFileUrl,
   //              FileType = att.FileType,
   //              OriginalFileName = att.FileName, // Endret fra FileName
   //              OriginalFileSize = att.FileSize ?? 0, // Endret fra FileSize
   //              KeyInfo = JsonConvert.SerializeObject(att.KeyInfo),
   //              IV = att.IV,
   //              Version = att.Version,
   //              CreatedAt = DateTime.UtcNow // Legg til CreatedAt
   //          });
   //
   //          context.MessageAttachments.AddRange(attachments);
   //      }
   //
   //      // 🎯 Intelligent conversation oppdatering
   //      var existingEntry = context.Entry(conversation);
   //      if (existingEntry.State == EntityState.Detached)
   //      {
   //          context.Conversations.Attach(conversation);
   //          conversation.LastMessageSentAt = encryptedMessage.SentAt;
   //      }
   //      else
   //      {
   //          conversation.LastMessageSentAt = encryptedMessage.SentAt;
   //      }
   //
   //      // Lagre alt i én transaksjon
   //      await context.SaveChangesAsync();
   //
   //      // Hent respons
   //      var response = await MapEncryptedToResponseDtoOptimized(encryptedMessage.Id);
   //
   //      // Hent participants for notifikasjoner
   //      var participantIds = await context.ConversationParticipants
   //          .AsNoTracking()
   //          .Where(cp => cp.ConversationId == conversation.Id)
   //          .Select(cp => cp.UserId)
   //          .ToArrayAsync();
   //      
   //      // Send encrypted notifikasjoner
   //      taskQueue.QueueAsync(async () => 
   //      {
   //          // Først SignalR-notifikasjoner
   //          await NotifyAndBroadcastEncryptedAsync(
   //              conversationId: conversation.Id,
   //              isGroup: conversation.IsGroup,
   //              groupName: conversation.GroupName,
   //              groupImageUrl: conversation.GroupImageUrl,
   //              participantIds: participantIds,
   //              senderId: senderId,
   //              receiverId: null,
   //              response: response);
   //      
   //          // Så sync event med ny scope (ikke-kritisk)
   //          using var scope = scopeFactory.CreateScope();
   //          var syncService = scope.ServiceProvider.GetRequiredService<ISyncService>(); 
   //          var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
   //      
   //          try 
   //          {
   //              Dictionary<int, string>? groupRequestStatuses = null;
   //              if (conversation.IsGroup)
   //              {
   //                  groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
   //                      context, conversation.Id, participantIds);
   //              }
   //
   //              var conversationSyncData = await SyncEventExtensions.BuildConversationSyncData(
   //                  context, 
   //                  conversation, 
   //                  participantIds,
   //                  groupRequestStatuses
   //              );
   //              
   //              await syncService.CreateAndDistributeSyncEventAsync(
   //                  eventType: SyncEventTypes.NEW_MESSAGE,
   //                  eventData: new {
   //                      message = response, // Encrypted response
   //                      conversation = conversationSyncData
   //                  },
   //                  targetUserIds: participantIds,
   //                  source: "API",
   //                  relatedEntityId: response.Id,
   //                  relatedEntityType: "Message"
   //              );
   //          }
   //          catch (Exception ex)
   //          {
   //              logger.LogError(ex, "Failed to create sync event for encrypted message {MessageId}", response.Id);
   //          }
   //      });
   //
   //      return response;
   //  }
   //  
   //  private async Task NotifyAndBroadcastEncryptedAsync(
   //      int conversationId,
   //      bool isGroup,
   //      string? groupName,
   //      string? groupImageUrl,
   //      int[] participantIds,
   //      int senderId,
   //      int? receiverId,
   //      EncryptedMessageResponseDTO response,
   //      bool shouldSendSignalR = true,
   //      bool shouldCreateNotifications = true,
   //      bool needsMessageRequestNotification = false,
   //      bool isRejectedSender = false)
   //  {
   //      using var scope = scopeFactory.CreateScope();
   //      var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
   //      
   //      /* 1. Send over SignalR med per-bruker isSilent */
   //      
   //      var approvedUsers = new HashSet<int>();
   //      int? creatorId = null;
   //      
   //      if (shouldSendSignalR)
   //      {
   //          if (isGroup)
   //          {
   //              // Hent både approved users og creator i én gang
   //              var approvedUsersList = await context.GroupRequests
   //                  .Where(gr => gr.ConversationId == conversationId && 
   //                               participantIds.Contains(gr.ReceiverId) &&
   //                               gr.Status == GroupRequestStatus.Approved)
   //                  .Select(gr => gr.ReceiverId)
   //                  .ToListAsync();
   //      
   //              approvedUsers = approvedUsersList.ToHashSet();
   //                  
   //              creatorId = await context.Conversations
   //                  .Where(c => c.Id == conversationId)
   //                  .Select(c => c.CreatorId)
   //                  .FirstOrDefaultAsync();
   //          }
   //
   //          var signalrTasks = participantIds.Select(async uid =>
   //          {
   //              try
   //              {
   //                  // 🆕 Beregn isSilent per bruker
   //                  bool userIsSilent = false;
   //                  if (isGroup)
   //                  {
   //                      bool isCreator = uid == creatorId;
   //                      bool hasApproved = approvedUsers.Contains(uid);
   //                      
   //                      // Silent hvis ikke creator og ikke approved
   //                      userIsSilent = !isCreator && !hasApproved;
   //                  }
   //
   //                  // 🆕 Opprett kopi av encrypted response med bruker-spesifikk isSilent
   //                  var userResponse = new EncryptedMessageResponseDTO
   //                  {
   //                      Id = response.Id,
   //                      SenderId = response.SenderId,
   //                      Sender = response.Sender,
   //                      EncryptedText = response.EncryptedText,
   //                      KeyInfo = response.KeyInfo,
   //                      IV = response.IV,
   //                      Version = response.Version,
   //                      SentAt = response.SentAt,
   //                      ConversationId = response.ConversationId,
   //                      IsSilent = userIsSilent, // 🆕 Per-bruker silent
   //                      EncryptedAttachments = response.EncryptedAttachments,
   //                      Reactions = response.Reactions,
   //                      ParentMessageId = response.ParentMessageId,
   //                      ParentMessagePreview = response.ParentMessagePreview,
   //                      IsNowApproved = response.IsNowApproved,
   //                      IsRejectedRequest = response.IsRejectedRequest,
   //                      ParentSender = response.ParentSender,
   //                      IsSystemMessage = response.IsSystemMessage,
   //                      IsDeleted = response.IsDeleted
   //                  };
   //
   //                  // Send encrypted message over SignalR - frontend will decrypt
   //                  await hubContext.Clients.AppUser(uid.ToString())
   //                      .SendAsync("ReceiveEncryptedMessage", userResponse);
   //              }
   //              catch (Exception ex)
   //              {
   //                  logger.LogWarning(ex, "Failed to send encrypted message to appUser {UserId}", uid);
   //              }
   //          });
   //
   //          await Task.WhenAll(signalrTasks);
   //      }
   //      else if (isRejectedSender)
   //      {
   //          await hubContext.Clients.AppUser(senderId.ToString())
   //              .SendAsync("ReceiveEncryptedMessage", response);
   //      }
   //      
   //      var notifSvc = scope.ServiceProvider.GetRequiredService<IMessageNotificationService>();
   //      
   //      /* 2. MessageRequest notification hvis nødvendig */
   //      if (needsMessageRequestNotification && !isGroup && receiverId.HasValue)
   //      {
   //          var notification = await notifSvc.CreateMessageRequestNotificationAsync(
   //              senderId, receiverId.Value, conversationId);
   //
   //          // Send SignalR for MessageRequest
   //          if (notification != null && notification.Type == NotificationType.MessageRequest)
   //          {
   //              await hubContext.Clients.AppUser(receiverId.Value.ToString()).SendAsync("MessageRequestCreated", new MessageRequestCreatedDto
   //              {
   //                  SenderId = senderId,
   //                  ReceiverId = receiverId.Value,
   //                  ConversationId = conversationId,
   //                  Notification = notification
   //              });
   //          }
   //      }
   //
   //      /* 3. Lag notifications kun for approved users i grupper */
   //      if (!shouldCreateNotifications || isRejectedSender) return;
   //      
   //      foreach (var uid in participantIds)
   //      {
   //          if (uid == senderId) continue;
   //      
   //          // 🆕 For grupper: kun lag notifikasjon hvis bruker har approved
   //          bool shouldCreateNotification = true;
   //          if (isGroup)
   //          {
   //              // Bruk allerede hentet data
   //              bool isCreator = uid == creatorId;
   //              bool hasApproved = approvedUsers.Contains(uid);
   //          
   //              shouldCreateNotification = isCreator || hasApproved;
   //          }
   //      
   //          if (shouldCreateNotification)
   //          {
   //              await notifSvc.CreateMessageNotificationAsync(
   //                  recipientUserId: uid,
   //                  senderUserId: senderId, 
   //                  conversationId: conversationId,
   //                  messageId: response.Id);
   //          }
   //      }
   //  }
// }
