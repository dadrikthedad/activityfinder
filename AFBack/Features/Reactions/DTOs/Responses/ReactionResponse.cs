namespace AFBack.Features.Reactions.DTOs.Responses;

/// <summary>
/// Response til frontend for reactions
/// </summary>
public class ReactionResponse
{
    public int MessageId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    
}
