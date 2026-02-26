using AFBack.Features.Reactions.Enums;

namespace AFBack.Features.Reactions.DTOs.Responses;

/// <summary>
/// Respons etter en reaksjons-operasjon (add/update/remove)
/// </summary>
public class ReactionAddedResponse
{
    /// <summary>
    /// Hva som skjedde med reaksjonen
    /// </summary>
    public ReactionAction Action { get; set; }
}
