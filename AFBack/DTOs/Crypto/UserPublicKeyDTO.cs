namespace AFBack.DTOs.Crypto;

public class UserPublicKeyDTO
{
    public int UserId { get; set; }
    public string PublicKey { get; set; } = string.Empty;
    public int KeyVersion { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}
    
public class StorePublicKeyRequestDTO
{
    public string PublicKey { get; set; } = string.Empty;
}
    
public class ConversationKeyDTO
{
    public int ConversationId { get; set; }
    public List<UserPublicKeyDTO> ParticipantKeys { get; set; } = new();
    public int KeyRotationVersion { get; set; } = 1;
}