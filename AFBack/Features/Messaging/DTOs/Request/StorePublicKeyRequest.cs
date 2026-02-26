using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Messaging.DTOs.Request;

public class StorePublicKeyRequest
{
    [StringLength(44, MinimumLength = 44, ErrorMessage = "Invalid public key format")]
    public string PublicKey { get; set; } = string.Empty;
}
