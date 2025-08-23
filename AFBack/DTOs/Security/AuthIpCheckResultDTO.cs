using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Resultat fra IP-ban sjekk for auth endpoints
/// </summary>
public class AuthIpCheckResult
{
    public bool IsBanned { get; set; }
    public IActionResult? ActionResult { get; set; }
    public string? ClientIp { get; set; }
    public string? DeviceId { get; set; } // NYTT
    public bool IsMobileApp { get; set; } // NYTT
    public bool IsSharedNetwork { get; set; } 
}