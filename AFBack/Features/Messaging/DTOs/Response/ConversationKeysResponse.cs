namespace AFBack.Features.Messaging.DTOs.Response;

public class ConversationKeysResponse
{
    public List<UserPublicKeyResponse> ParticipantKeys { get; set; } = [];
}
