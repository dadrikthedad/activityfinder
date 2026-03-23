using AFBack.Data;
using AFBack.Features.Conversation.Enums;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;
using Microsoft.EntityFrameworkCore;
using ConversationDto = AFBack.Features.Conversation.DTOs.ConversationDto;

namespace AFBack.Features.Conversation.Repository;

public class ConversationRepository(
    AppDbContext context) : IConversationRepository
{   
    
    ////////////////////////////////////////////// GET SINGLE CONVERSATION ////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<Models.Conversation?> GetConversationAsync(int conversationId, CancellationToken ct = default)
        => await context.Conversations
        .Include(conversation => conversation.Participants)
        .AsNoTracking()
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId, ct);
    
    /// <inheritdoc />
    public async Task<Models.Conversation?> GetConversationWithTrackingAsync(int conversationId,
        CancellationToken ct = default) => await 
        context.Conversations
        .Include(conversation => conversation.Participants)
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId, ct);
    
   
    /// <inheritdoc />
    public async Task<ConversationDto?> GetConversationDtoAsync(int conversationId, CancellationToken ct = default) => 
         await context.Conversations
        .AsNoTracking()
        .Where(c => c.Id == conversationId)
        .ToConversationDtoQuery()
        .FirstOrDefaultAsync(ct);
    
    /// <inheritdoc />
    public async Task<ConversationDto?> GetConversationBetweenUsersAsync(string userId, string receiverId,
        CancellationToken ct = default) =>
        await context.Conversations
            .Where(c => c.Type != ConversationType.GroupChat
                        && c.Participants.Any(cp => cp.UserId == userId)
                        && c.Participants.Any(cp => cp.UserId == receiverId))
            .Include(c => c.Participants)
            .ToConversationDtoQuery()
            .FirstOrDefaultAsync(ct);
    
    ////////////////////////////////////////////// GET MANY CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetActiveConversationsAsync(string userId, int page, int pageSize, 
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.ConversationArchived == false
                         && cp.Status == ConversationStatus.Accepted)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync(ct);
    
    /// <inheritdoc />
    public async Task<int> GetActiveConversationsCountAsync(string userId, CancellationToken ct = default) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && !cp.ConversationArchived
                              && cp.Status == ConversationStatus.Accepted, ct);
    
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetPendingConversationsAsync(string userId, int page, int pageSize,
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.Status == ConversationStatus.Pending)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync(ct);
    
    /// <inheritdoc />
    public async Task<int> GetPendingConversationsCountAsync(string userId, CancellationToken ct = default) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.Status == ConversationStatus.Pending, ct);
    
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetArchivedConversationsAsync(string userId, int page, int pageSize, 
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.ConversationArchived == true)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync(ct);
    
    /// <inheritdoc />
    public async Task<int> GetArchivedConversationsCountAsync(string userId, CancellationToken ct = default) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.ConversationArchived == true, ct);
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetRejectedConversationsAsync(string userId, int page, int pageSize,
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.Status == ConversationStatus.Rejected)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync(ct);
    
    /// <inheritdoc />
    public async Task<int> GetRejectedConversationsCountAsync(string userId, CancellationToken ct = default) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.Status == ConversationStatus.Rejected, ct);
    
    /// <inheritdoc />
    public async Task<List<string>> GetAllConversationPartnerIdsAsync(string userId, CancellationToken ct = default)
        =>
        await context.ConversationParticipants
            .Where(cp => cp.Conversation.Participants 
                .Any(p => p.UserId == userId)) // Alle samtaler brukeren er participant
            .Where(cp => cp.UserId != userId) // Filtrerer bort oss selv
            .Where(cp => cp.Status == ConversationStatus.Accepted 
                         || cp.Status == ConversationStatus.Pending) // Ingen rejected
            .Select(cp => cp.UserId)
            .Distinct()
            .ToListAsync(ct);
    
    /// <inheritdoc />
    public async Task<List<string>> GetAcceptedParticipantIdsAsync(int conversationId, 
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.ConversationId == conversationId &&
                         cp.Status == ConversationStatus.Accepted)
            .Select(cp => cp.UserId)
            .ToListAsync(ct);
    
    ////////////////////////////////////////////// SEARCH CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<int> GetTotalConversationsBySearch(string userId, string searchQuery, 
        CancellationToken ct = default) => 
        await context.ConversationParticipants
            .FilterBySearchQuery(userId, searchQuery)
            .CountAsync(ct);
    
    
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetConversationDtosBySearch(string userId, string searchQuery, 
        int page, int pageSize, CancellationToken ct = default) 
        => await context
        .ConversationParticipants
        .AsNoTracking()
        .FilterBySearchQuery(userId, searchQuery)
        .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToConversationDtoQuery()
        .ToListAsync(ct);
    
    
    ////////////////////////////////////////////// CREATE CONVERSATIONS /////////////////////////////////////////////

    /// <inheritdoc />
    public async Task<Models.Conversation> CreateConversationWithParticipantsAsync(
        Models.Conversation conversation, 
        List<ConversationParticipant> participants,
        Message? message = null, CancellationToken ct = default)
    {
        // Kjør transaksjon
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
    
        try
        {
            // Opprett Conversation og lagrer for å få id
            await context.Conversations.AddAsync(conversation, ct);
            await context.SaveChangesAsync(ct);
        
            // Oppdater participants med conversationId
            participants.ForEach(p => p.ConversationId = conversation.Id);
            
            // Legg til Participants i databasen
            await context.ConversationParticipants.AddRangeAsync(participants, ct);
            
            // Legg til melding hvis den finnes (1-1 samtaler har første melding, gruppesamtaler har ikke)
            if (message != null)
            {
                message.ConversationId = conversation.Id;
                await context.Messages.AddAsync(message, ct);
                conversation.LastMessageSentAt = message.SentAt;
            }
            
            await context.SaveChangesAsync(ct);
            
            // Bekrefter databaselagringen
            await transaction.CommitAsync(ct);
            return conversation;
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    
    ////////////////////////////////////////////// UPDATE CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken ct = default) => await context.SaveChangesAsync(ct);
    
    /// <inheritdoc />
    public async Task UpdateLastMessageSentAt(int conversationId, DateTime sentAt, CancellationToken ct = default) 
        => await context.Conversations
        .Where(c => c.Id == conversationId)
        .ExecuteUpdateAsync(s => 
            s.SetProperty(c => c.LastMessageSentAt, sentAt), ct);

    ////////////////////////////////////////////// DELETE CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task DeleteConversationAsync(Models.Conversation conversation, CancellationToken ct = default)
    {
        context.Conversations.Remove(conversation);
        await context.SaveChangesAsync(ct);
    }
    
    ////////////////////////////////////////////// PARTICIPANT OPERATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<ConversationParticipant?> GetParticipantAsync(string userId, int conversationId, 
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.UserId == userId && cp.ConversationId == conversationId, ct);
    
    /// <inheritdoc />
    public async Task RemoveParticipantAsync(ConversationParticipant participant, CancellationToken ct = default)
    {
        context.ConversationParticipants.Remove(participant);
        await context.SaveChangesAsync(ct);
    }
    
    /// <inheritdoc />
    public async Task<HashSet<int>> GetUserAcceptedConversationIdsAsync(string userId, List<int> conversationIds,
        CancellationToken ct = default)
    {
        if (conversationIds.Count == 0)
            return [];
        
        var ids = await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId 
                         && conversationIds.Contains(cp.ConversationId)
                         && cp.Status == ConversationStatus.Accepted)
            .Select(cp => cp.ConversationId)
            .ToListAsync(ct);
        
        return ids.ToHashSet();
    }
    
    
    /// <inheritdoc />
    public async Task<ConversationParticipant?> GetNextCreatorCandidateAsync(int conversationId, string excludeUserId,
        CancellationToken ct = default) =>
        await context.ConversationParticipants
            .Where(cp => cp.ConversationId == conversationId
                         && cp.UserId != excludeUserId
                         && cp.Status == ConversationStatus.Accepted)
            .OrderBy(cp => cp.InvitedAt)
            .FirstOrDefaultAsync(ct);
}
