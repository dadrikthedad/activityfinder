namespace AFBack.Infrastructure.Email.Models;

/// <summary>
/// DTO for kombinert verifisering + security alert epost ved telefon-bytte.
/// Sendes til brukerens NÅVÆRENDE epost (steg 1).
/// Inneholder verifiseringskode, nytt telefonnummer og "This wasn't me"-knapp.
/// </summary>
public sealed record PhoneChangeVerificationDto(
    string Email,            // Nåværende epost (mottaker)
    string NewPhoneNumber,   // Nytt nummer (vises i meldingen)
    string VerificationCode,
    string BaseUrl,
    string AlertUrl          // "This wasn't me"-lenke
);
