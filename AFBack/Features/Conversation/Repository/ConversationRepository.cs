using AFBack.Data;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;
using AFBack.Models.Enums;
using Microsoft.EntityFrameworkCore;
using ConversationDto = AFBack.Features.Conversation.DTOs.ConversationDto;

namespace AFBack.Features.Conversation.Repository;

public class ConversationRepository(
    AppDbContext context) : IConversationRepository
{   
    
    ////////////////////////////////////////////// GET SINGLE CONVERSATION ////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<Models.Conversation?> GetConversationAsync(int conversationId) => await context.Conversations
        .Include(conversation => conversation.Participants)
        .AsNoTracking()
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);
    
    /// <inheritdoc />
    public async Task<Models.Conversation?> GetConversationWithTrackingAsync(int conversationId) => await 
        context.Conversations
        .Include(conversation => conversation.Participants)
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);
    
   
    /// <inheritdoc />
    public async Task<ConversationDto?> GetConversationDtoAsync(int conversationId) => 
         await context.Conversations
        .AsNoTracking()
        .Where(c => c.Id == conversationId)
        .ToConversationDtoQuery()
        .FirstOrDefaultAsync();
    
    /// <inheritdoc />
    public async Task<ConversationDto?> GetConversationBetweenUsersAsync(string userId, string receiverId) =>
        await context.Conversations
            .Where(c => c.Type != ConversationType.GroupChat
                        && c.Participants.Any(cp => cp.UserId == userId)
                        && c.Participants.Any(cp => cp.UserId == receiverId))
            .Include(c => c.Participants)
            .ToConversationDtoQuery()
            .FirstOrDefaultAsync();
    
    /// <inheritdoc />
    public async Task<int?> GetPendingConversationIdBetweenUsersAsync(string userId, string otherUserId) =>
        await context.Conversations
            .Where(c => c.Type == ConversationType.PendingRequest
                        && c.Participants.Any(p => p.UserId == userId)
                        && c.Participants.Any(p => p.UserId == otherUserId))
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();
    
    ////////////////////////////////////////////// GET MANY CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetActiveConversationsAsync(string userId, int page, int pageSize) =>
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
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task<int> GetActiveConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && !cp.ConversationArchived
                              && cp.Status == ConversationStatus.Accepted);
    
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetPendingConversationsAsync(string userId, int page, int pageSize) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.Status == ConversationStatus.Pending)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task<int> GetPendingConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.Status == ConversationStatus.Pending);
    
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetArchivedConversationsAsync(string userId, int page, int pageSize) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.ConversationArchived == true)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task<int> GetArchivedConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.ConversationArchived == true);
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetRejectedConversationsAsync(string userId, int page, int pageSize) =>
        await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId
                         && cp.Status == ConversationStatus.Rejected)
            .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            // Mapper til ConversationDto som er felles med de andre metodene
            .ToConversationDtoQuery() // Mapper til extensions-metode
            .ToListAsync();
    
    /// <inheritdoc />
    public async Task<int> GetRejectedConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.Status == ConversationStatus.Rejected);
    
    /// <inheritdoc />
    public async Task<List<string>> GetAllConversationPartnerIdsAsync(string userId) =>
        await context.ConversationParticipants
            .Where(cp => cp.Conversation.Participants 
                .Any(p => p.UserId == userId)) // Alle samtaler brukeren er participant
            .Where(cp => cp.UserId != userId) // Filtrerer bort oss selv
            .Where(cp => cp.Status == ConversationStatus.Accepted 
                         || cp.Status == ConversationStatus.Pending) // Ingen rejected
            .Select(cp => cp.UserId)
            .Distinct()
            .ToListAsync();
    
    ////////////////////////////////////////////// SEARCH CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<int> GetTotalConversationsBySearch(string userId, string searchQuery) => 
        await context.ConversationParticipants
            .FilterBySearchQuery(userId, searchQuery)
            .CountAsync();
    
    
    
    /// <inheritdoc />
    public async Task<List<ConversationDto>> GetConversationDtosBySearch(string userId, string searchQuery, 
        int page, int pageSize) 
        => await context
        .ConversationParticipants
        .AsNoTracking()
        .FilterBySearchQuery(userId, searchQuery)
        .OrderByDescending(cp => cp.Conversation.LastMessageSentAt ?? DateTime.MinValue)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToConversationDtoQuery()
        .ToListAsync();
    
    
    ////////////////////////////////////////////// CREATE CONVERSATIONS /////////////////////////////////////////////

    /// <inheritdoc />
    public async Task<Models.Conversation> CreateConversationWithParticipantsAsync(
        Models.Conversation conversation, 
        List<ConversationParticipant> participants,
        Message? message = null)
    {
        // Kjør transaksjon
        await using var transaction = await context.Database.BeginTransactionAsync();
    
        try
        {
            // Opprett Conversation og lagrer for å få id
            await context.Conversations.AddAsync(conversation);
            await context.SaveChangesAsync();
        
            // Oppdater participants med conversationId
            participants.ForEach(p => p.ConversationId = conversation.Id);
            
            // Legg til Participants i databasen
            await context.ConversationParticipants.AddRangeAsync(participants);
            
            // Legg til melding hvis den finnes (1-1 samtaler har første melding, gruppesamtaler har ikke)
            if (message != null)
            {
                message.ConversationId = conversation.Id;
                await context.Messages.AddAsync(message);
                conversation.LastMessageSentAt = message.SentAt;
            }
            
            await context.SaveChangesAsync();
            
            // Bekrefter databaselagringen
            await transaction.CommitAsync();
            return conversation;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    
    ////////////////////////////////////////////// UPDATE CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
    
    /// <inheritdoc />
    public async Task UpdateLastMessageSentAt(int conversationId, DateTime sentAt) => await context.Conversations
        .Where(c => c.Id == conversationId)
        .ExecuteUpdateAsync(s => 
            s.SetProperty(c => c.LastMessageSentAt, sentAt));

    ////////////////////////////////////////////// DELETE CONVERSATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task DeleteConversationAsync(Models.Conversation conversation)
    {
        context.Conversations.Remove(conversation);
        await context.SaveChangesAsync();
    }
    
    ////////////////////////////////////////////// PARTICIPANT OPERATIONS /////////////////////////////////////////////
    
    /// <inheritdoc />
    public async Task<ConversationParticipant?> GetParticipantAsync(string userId, int conversationId) =>
        await context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.UserId == userId && cp.ConversationId == conversationId);
    
    /// <inheritdoc />
    public async Task RemoveParticipantAsync(ConversationParticipant participant)
    {
        context.ConversationParticipants.Remove(participant);
        await context.SaveChangesAsync();
    }
    
    /// <inheritdoc />
    public async Task<HashSet<int>> GetUserAcceptedConversationIdsAsync(string userId, List<int> conversationIds)
    {
        if (conversationIds.Count == 0)
            return [];
        
        var ids = await context.ConversationParticipants
            .AsNoTracking()
            .Where(cp => cp.UserId == userId 
                         && conversationIds.Contains(cp.ConversationId)
                         && cp.Status == ConversationStatus.Accepted)
            .Select(cp => cp.ConversationId)
            .ToListAsync();
        
        return ids.ToHashSet();
    }
    
    
    /// <inheritdoc />
    public async Task<ConversationParticipant?> GetNextCreatorCandidateAsync(int conversationId, string excludeUserId) =>
        await context.ConversationParticipants
            .Where(cp => cp.ConversationId == conversationId
                         && cp.UserId != excludeUserId
                         && cp.Status == ConversationStatus.Accepted)
            .OrderBy(cp => cp.InvitedAt)
            .FirstOrDefaultAsync();
}
