namespace AFBack.Infrastructure.Email.Models;

/// <summary>
/// DTO for sikkerhetsvarslings-epost.
/// Sendes til brukerens nåværende epost når noen ber om å bytte epost eller telefon.
/// </summary>
public sealed record SecurityAlertEmailDto(
    string Email,
    string ChangeType,       // "email address" eller "phone number"
    string SecurityAlertUrl, // Full URL med token for "This wasn't me"
    string BaseUrl
);
