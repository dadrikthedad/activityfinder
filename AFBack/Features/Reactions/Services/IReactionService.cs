using AFBack.Common.Results;
using AFBack.Features.Reactions.DTOs.Responses;

namespace AFBack.Features.Reactions.Services;

public interface IReactionService
{
    /// <summary>
    /// Legger til, oppdaterer eller sletter (toggle) en brukers reaksjon på en melding.
    /// Validerer tilgang via CanSend-cache, sjekker eksisterende reaksjon, og broadcaster
    /// endringene til alle aksepterte deltakere i samtalen via bakgrunnsjobb.
    /// </summary>
    /// <param name="userId">ID til brukeren som reagerer</param>
    /// <param name="conversationId">ID til samtalen meldingen tilhører</param>
    /// <param name="messageId">ID til meldingen det reageres på</param>
    /// <param name="emoji">Emoji-tegnet som brukes som reaksjon</param>
    /// <returns>Result med ReactionResponse som inneholder utført handling (Added, Updated, Removed)</returns>
    Task<Result<ReactionAddedResponse>> AddReactionAsync(string userId, int conversationId, int messageId,
        string emoji);


}
