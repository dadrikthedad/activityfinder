using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Resultat fra IP-ban sjekk for auth endpoints
/// </summary>
public class AuthIpCheckResult
{
    public bool IsBanned { get; set; }
    public string? ClientIp { get; set; }
    public IActionResult? ActionResult { get; set; }
}