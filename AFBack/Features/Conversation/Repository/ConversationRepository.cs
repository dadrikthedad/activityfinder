using AFBack.Data;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;
using AFBack.Models.Enums;
using Microsoft.EntityFrameworkCore;
using ConversationDto = AFBack.Features.Conversation.DTOs.ConversationDto;

namespace AFBack.Features.Conversation.Repository;

public class ConversationRepository(
    ApplicationDbContext context) : IConversationRepository
{   
    
    ////////////////////////////////////////////// GET SINGLE CONVERSATION ////////////////////////////////////////////
    
    // Sjekk interface for summary
    public async Task<Models.Conversation?> GetConversationAsync(int conversationId) => await context.Conversations
        .Include(conversation => conversation.Participants)
        .AsNoTracking()
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);
    
    // Sjekk interface for summary
    public async Task<Models.Conversation?> GetConversationWithTrackingAsync(int conversationId) => await 
        context.Conversations
        .Include(conversation => conversation.Participants)
        .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);
    
   
    // Sjekk interface for summary
    public async Task<ConversationDto?> GetConversationDtoAsync(int conversationId) => 
         await context.Conversations
        .AsNoTracking()
        .Where(c => c.Id == conversationId)
        .ToConversationDtoQuery()
        .FirstOrDefaultAsync();
    
    // Sjekk interface for summary
    public async Task<ConversationDto?> GetConversationBetweenUsersAsync(string userId, string receiverId) =>
        await context.Conversations
            .Where(c => c.Type != ConversationType.GroupChat
                        && c.Participants.Any(cp => cp.UserId == userId)
                        && c.Participants.Any(cp => cp.UserId == receiverId))
            .Include(c => c.Participants)
            .ToConversationDtoQuery()
            .FirstOrDefaultAsync();
    
    ////////////////////////////////////////////// GET MANY CONVERSATIONS /////////////////////////////////////////////
    
    // Sjekk interface for summary
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
    
    // Sjekk interface for summary
    public async Task<int> GetActiveConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && !cp.ConversationArchived
                              && cp.Status == ConversationStatus.Accepted);
    
    
    // Sjekk interface for summary
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
    
    // Sjekk interface for summary
    public async Task<int> GetPendingConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.Status == ConversationStatus.Pending);
    
    
    // Sjekk interface for summary
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
    
    // Sjekk interface for summary
    public async Task<int> GetArchivedConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.ConversationArchived == true);
    
    // Sjekk interface for summary
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
    
    // Sjekk interface for summary
    public async Task<int> GetRejectedConversationsCountAsync(string userId) =>
        await context.ConversationParticipants
            .CountAsync(cp => cp.UserId == userId
                              && cp.Status == ConversationStatus.Rejected);
    
    ////////////////////////////////////////////// SEARCH CONVERSATIONS /////////////////////////////////////////////
    
    // Sjekk interface for summary
    public async Task<int> GetTotalConversationsBySearch(string userId, string searchQuery) => 
        await context.ConversationParticipants
            .FilterBySearchQuery(userId, searchQuery)
            .CountAsync();
    
    
    
    // Sjekk interface for summary
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

    // Sjekk interface for summary
    public async Task<Models.Conversation> CreateConversationWithParticipantsAsync(
        Models.Conversation conversation, 
        List<ConversationParticipant> participants,
        Message message)
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
            
            // Legg til samtalen melding hører til og legg til melding i databasen
            message.ConversationId = conversation.Id;
            await context.Messages.AddAsync(message);
            
            // Oppdatere når melding er sendt
            conversation.LastMessageSentAt = message.SentAt;
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
    
    // Sjekk interface for summary
    public async Task SaveChangesAsync() => await context.SaveChangesAsync();
    
    // Sjekk interface for summary
    public async Task UpdateLastMessageSentAt(int conversationId, DateTime sentAt) => await context.Conversations
        .Where(c => c.Id == conversationId)
        .ExecuteUpdateAsync(s => 
            s.SetProperty(c => c.LastMessageSentAt, sentAt));

    ////////////////////////////////////////////// DELETE CONVERSATIONS /////////////////////////////////////////////
    
    // Sjekk interface for summary
    public async Task DeleteConversationAsync(int conversationId)
    {
        var conversation = await GetConversationWithTrackingAsync(conversationId);
        
        context.Conversations.Remove(conversation!);
        await context.SaveChangesAsync();
    }
    
}
