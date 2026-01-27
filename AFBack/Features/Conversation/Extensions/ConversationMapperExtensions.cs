using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Models;
using AFBack.Models.Enums;
using Microsoft.EntityFrameworkCore;
using ConversationDto = AFBack.Features.Conversation.DTOs.ConversationDto;

namespace AFBack.Features.Conversation.Extensions;

public static class ConversationMapperExtensions
{
    /// <summary>
    /// Mapper et ConversationDto til en ConversationResponse som er det frontend forventer
    /// </summary>
    /// <param name="conversationDto">ConversationDto hentet fra databasen</param>
    /// <param name="users">Brukere hentet fra cache</param>
    /// <returns>ConversationResponse</returns>
    public static ConversationResponse ToResponse(this ConversationDto conversationDto,
        Dictionary<string, UserSummaryDto> users)
        => new()
        {
            Id = conversationDto.Id,
            Type = conversationDto.Type,
            GroupName = conversationDto.GroupName,
            GroupImageUrl = conversationDto.GroupImageUrl,
            LastMessageSentAt = conversationDto.LastMessageSentAt,
            Participants = conversationDto.Participants
                .Select(p => new ParticipantResponse
                {
                    User = users.GetValueOrDefault(p.UserId) ?? new UserSummaryDto
                    {
                        Id = p.UserId,
                        FullName = "Unknown User",
                        ProfileImageUrl = null
                    },
                    Status = p.Status,
                    Role = p.Role,
                    PendingMessagesReceived = p.PendingMessagesReceived
                })
                .ToList()
        };
    
    
    /// <summary>
    /// Mapper en liste med ConversationResponses til et ConversationsResponse for å returnere flere samtaler
    /// med pagineringsdata
    /// </summary>
    /// <param name="conversations">Listen med ConversationResponses</param>
    /// <param name="totalCount">Total antall samtaler</param>
    /// <param name="page">Siden vi har hentet fra</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>ConversationsResponse med ConversationResponses</returns>
    public static ConversationsResponse ToResponse(this List<ConversationResponse> conversations, 
        int totalCount, int page, int pageSize) => new()
    {
        Conversations = conversations,
        TotalCount = totalCount,
        CurrentPage = page, 
        PageSize = pageSize,
        HasMore = page * pageSize < totalCount
    };
    
    // ======================================= Repository metoder =======================================
    
    
    /// <summary>
    /// Mapper til conversationDto via Conversation
    /// </summary>
    /// <param name="query">Spørringen vi skal mappe fra</param>
    /// <returns>IQueryable med ConversationDto</returns>
    public static IQueryable<ConversationDto> ToConversationDtoQuery(this IQueryable<ConversationParticipant> query)
    => query.Select(cp => new ConversationDto
    {
        Id = cp.Conversation.Id,
        Type = cp.Conversation.Type,
        GroupName = cp.Conversation.GroupName,
        GroupImageUrl = cp.Conversation.GroupImageUrl,
        LastMessageSentAt = cp.Conversation.LastMessageSentAt,
        Participants = cp.Conversation.Participants
            .Select(p => new ParticipantDto
            {
                UserId = p.UserId,
                Status = p.Status,
                Role = p.Role,
                PendingMessagesReceived = p.PendingMessagesReceived
            }).ToList()
    });
    
    /// <summary>
    /// Mapper til conversationDto via ConversationParticipant - endringer i ConversationDto må endres he
    /// </summary>
    /// <param name="query">Spørringen vi skal mappe fra</param>
    /// <returns>IQueryable med ConversationDto</returns>
    public static IQueryable<ConversationDto> ToConversationDtoQuery(this IQueryable<Models.Conversation> query)
        => query.Select(c => new ConversationDto
        {
            Id = c.Id,
            Type = c.Type,
            GroupName = c.GroupName,
            GroupImageUrl = c.GroupImageUrl,
            LastMessageSentAt = c.LastMessageSentAt,
            Participants = c.Participants
                .Where(cp =>
                    cp.Status != ConversationStatus.Rejected
                    && !cp.ConversationArchived)
                .Select(cp => new ParticipantDto
                {
                    UserId = cp.UserId,
                    Status = cp.Status,
                    Role = cp.Role,
                    PendingMessagesReceived = cp.PendingMessagesReceived
                }).ToList()
        });
    
    /// <summary>
    /// En .WHERE som filterer vekk samtaler brukeren har arkivert og rejected, samt sjekker om
    /// samtaler hvor gruppenavn ikke er null stemmer med søkekriteriet eller om en av deltakerne stemmer med
    /// søkekriteriet
    /// </summary>
    /// <param name="query"></param>
    /// <param name="userId"></param>
    /// <param name="searchQuery"></param>
    /// <returns></returns>
    public static IQueryable<ConversationParticipant> FilterBySearchQuery(
        this IQueryable<ConversationParticipant> query, string userId, string searchQuery)
        => query.Where(cp =>
            cp.UserId == userId
            && !cp.ConversationArchived
            && cp.Status != ConversationStatus.Rejected
            && (
                // Søk i gruppenavn, kun for gruppechatter
                (cp.Conversation.Type == ConversationType.GroupChat
                 && cp.Conversation.GroupName != null
                 && EF.Functions.Like(cp.Conversation.GroupName, $"%{searchQuery}%"))
                ||  // Søk i navnet på deltakerne
                cp.Conversation.Participants.Any(p => p.UserId != userId
                                                      && EF.Functions.Like(p.AppUser.FullName, $"%{searchQuery}%")
                )
            ));

    public static ConversationDto ToResponse(this Models.Conversation conversation) => new ConversationDto
    {
        Id = conversation.Id,
        Type = conversation.Type,
        GroupName = conversation.GroupName,
        GroupImageUrl = conversation.GroupImageUrl,
        LastMessageSentAt = conversation.LastMessageSentAt,
        Participants = conversation.Participants.Select(cp => new ParticipantDto
        {
            UserId = cp.UserId,
            Status = cp.Status,
            Role = cp.Role,
            PendingMessagesReceived = cp.PendingMessagesReceived
        }).ToList()
    };
}
