using System.Text.Json.Serialization;

namespace AFBack.DTOs.Crypto;

public class SecretKeyResponseDTO
{
    public string Message { get; set; }
    public int UserId { get; set; }
    public string DeviceId { get; set; }
}