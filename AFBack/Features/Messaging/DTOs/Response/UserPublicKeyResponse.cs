namespace AFBack.Features.Messaging.DTOs.Response;

/// <summary>
/// Med UserId, PublicKey og KeyVersion
/// </summary>
public class UserPublicKeyResponse
{
    public string UserId { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public int KeyVersion { get; set; }
}
