using AFBack.Common.Results;

namespace AFBack.Features.Conversation.Validators;

public interface IGroupInviteValidator
{
    /// <summary>
    /// Validerer at brukere kan inviteres til en gruppe.
    /// Sjekker: duplikater, bruker eksistens, blokkeringer, allerede participant, og om de har forlatt gruppen.
    /// </summary>
    /// <param name="inviterId">Brukeren som inviterer</param>
    /// <param name="receiverIds">Brukerne som skal inviteres</param>
    /// <param name="conversationId">Samtale-ID (null ved opprettelse av ny gruppe)</param>
    /// <param name="existingParticipantIds">Eksisterende participants (null ved opprettelse av ny gruppe)</param>
    /// <returns>Result med success eller failure med feilmelding</returns>
    Task<Result> ValidateInviteAsync(
        string inviterId,
        List<string> receiverIds,
        int? conversationId = null,
        HashSet<string>? existingParticipantIds = null);
}
