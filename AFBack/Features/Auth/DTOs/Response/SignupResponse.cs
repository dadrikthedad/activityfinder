namespace AFBack.Features.Auth.DTOs.Response;

/// <summary>
/// Egenskaper: UserId som er nylig opprettet, EmailSent bool for å fortelle frontend om feil ved opprettelse
/// </summary>
public class SignupResponse
{
    public required string UserId { get; init; }
    public bool EmailSent { get; set; }
}
