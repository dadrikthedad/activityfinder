namespace AFBack.DTOs.Security;

public class BanResponseDto
{
   public string Error { get; set; } = "ACCESS_DENIED";
   public string Message { get; set; }
   public DateTime? BannedUntil { get; set; }
   public string ContactSupport { get; set; } = "support@koptr.net";
}