using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Response;

namespace AFBack.Features.Conversation.Services;

public interface IArchiveConversationService
{
    /// <summary>
    /// Arkiverer en brukers samtale, fjerner brukerne fra CanSend og lager en sync event til kun brukerns enheter
    /// </summary>
    /// <param name="userId">Brukerne som ønsker arkivering av samtale</param>
    /// <param name="conversationId">Samtalen som skal arkiveres</param>
    Task<Result> ArchiveConversationAsync(string userId, int conversationId);
    
    /// <summary>
    /// Gjenoppretter en arkivert direct chat samtale for en bruker. Lagrer i databasen, legger til i CanSend og
    /// lager SyncEvent for kun brukern
    /// </summary>
    /// <param name="userId">Brukeren som vil gjenopprette samtalen</param>
    /// <param name="conversationId">Samtalen</param>
    /// <returns>Result med ConversationResponse</returns>
    Task<Result<ConversationResponse>> RestoreArchivedConversationAsync(string userId, int conversationId);
}
