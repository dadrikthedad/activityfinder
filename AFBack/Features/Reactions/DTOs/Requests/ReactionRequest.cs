using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Reactions.DTOs.Requests;


/// <summary>
/// Request-modell for å legge til, oppdatere eller fjerne (toggle) en reaksjon på en melding.
/// </summary>
public class ReactionRequest
{
    /// <summary>
    /// ID til meldingen det reageres på
    /// </summary>
    [Required(ErrorMessage = "MessageId is required")]
    public int MessageId { get; set; }

    /// <summary>
    /// ID til samtalen meldingen tilhører
    /// </summary>
    [Required(ErrorMessage = "ConversationId is required")]
    public int ConversationId { get; set; }

    /// <summary>
    /// Emoji-tegnet som brukes som reaksjon (1-20 tegn)
    /// </summary>
    [Required(ErrorMessage = "Emoji is required")]
    [StringLength(20, MinimumLength = 1, ErrorMessage = "Emoji must be between 1 and 20 characters")]
    public string Emoji { get; set; } = string.Empty;
}
