using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;

namespace AFBack.Features.Conversation.Services;

public interface ISearchConversationsService
{
    /// <summary>
    /// Søker etter en samtale til en bruker. Henter ut antall samtaler først for pagineringen, deretter henter vi 
    /// ut en liste med alle samtaler som stemmer med søkeparameteret
    /// </summary>
    /// <param name="userId">Brukeren som søker</param>
    /// <param name="request">ConversationSearchRequest med søkequery, pagesize og page</param>
    /// <returns>Liste med ConversationsResponse eller tom liste</returns>
    Task<Result<ConversationsResponse>> SearchConversationsAsync(
        string userId, ConversationSearchRequest request);
}
