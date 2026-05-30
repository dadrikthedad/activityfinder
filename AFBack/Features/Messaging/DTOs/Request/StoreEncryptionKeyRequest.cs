using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Messaging.DTOs.Request;

public class StoreEncryptionKeyRequest
{
    [Required(ErrorMessage = "Public key is required")]
    [StringLength(44, MinimumLength = 44, ErrorMessage = "Invalid public key format")]
    public string PublicKey { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Recovery seed is required")]
    [StringLength(44, MinimumLength = 44, ErrorMessage = "Invalid recovery seed format")]
    public string RecoverySeed { get; set; } = string.Empty;
}
