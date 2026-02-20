namespace AFBack.Infrastructure.Email.Models;

/// <summary>
/// DTO for kombinert verifisering + security alert epost.
/// Sendes til brukerens NÅVÆRENDE epost ved epost-bytte (steg 1).
/// Inneholder verifiseringskode og "This wasn't me"-knapp.
/// </summary>
public sealed record EmailChangeVerificationDto(
    string Email,        // Nåværende epost (mottaker)
    string NewEmail,     // Ny epost (vises i meldingen)
    string VerificationCode,
    string BaseUrl,
    string AlertUrl      // "This wasn't me"-lenke
);
