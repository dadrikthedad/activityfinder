using AFBack.Common.Results;

namespace AFBack.Features.Auth.Services.Interfaces;

/// <summary>
/// Håndterer glemt passord-flyten (4 steg: epost-kode → verifiser → SMS-kode → reset passord).
/// </summary>
public interface IPasswordService
{
    
    // ======================== Bytt passord (innlogget) ======================== 

    /// <summary>
    /// Bytter passord for innlogget bruker.
    /// Krever at brukeren oppgir riktig nåværende passord.
    /// Ingen epost/SMS-verifisering nødvendig — bruker er allerede autentisert.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="currentPassword">Nåværende passord for å bekrefte identitet</param>
    /// <param name="newPassword">Nytt passord</param>
    /// <param name="ct"></param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> ChangePasswordAsync(string userId, string currentPassword, string newPassword,
        CancellationToken ct = default);
    
    
    // ======================== Glemt passord (ikke innlogget) ======================== 

    /// <summary>
    /// Steg 1: Sender passord-reset epost med 6-sifret kode.
    /// Krever at brukerens epost og telefon er verifisert.
    /// Hvis bruker ikke har verifisert epost, så sender vi en ny verifiseringsepost.
    /// </summary>
    /// <param name="email">E-posten som ber om glemt passord</param>
    /// <param name="ipAddress">IP-adressen som ber om glemt passord</param>
    /// <param name="ct"></param>
    /// <returns>Result: Returnerer alltid success for å forhindre email enumeration</returns>
    Task<Result> ForgotPasswordAsync(string email, string ipAddress, CancellationToken ct = default);

    /// <summary>
    /// Steg 2: Validerer epost-reset-koden.
    /// Ved suksess markeres PasswordResetEmailVerified = true,
    /// som låser opp muligheten til å sende SMS-kode.
    /// </summary>
    /// <param name="email">E-posten som prøver å verifisere</param>
    /// <param name="code">6-sifet kode fra brukeren</param>
    /// <param name="ipAddress">Brukerens IP-adresse</param>
    /// <param name="ct"></param>
    /// <returns>Result: Suksess ved riktig kode eller Failure hvis feil kode</returns>
    Task<Result> VerifyPasswordResetEmailCodeAsync(string email, string code, string ipAddress, 
        CancellationToken ct = default);

    /// <summary>
    /// Steg 3: Sender SMS-kode for passord-reset.
    /// Krever at PasswordResetEmailVerified == true (steg 2 er fullført).
    /// Validerer ikke brukerens telefonnummer, de har allerede bekreftet epost
    /// </summary>
    /// <param name="email">E-posten som prøver å verifisere</param>
    /// <param name="ipAddress">Brukerens IP-adresse</param>
    /// <param name="ct"></param>
    /// <returns>Result: Suksess ved sendt SMS eller Failure hvis noe gikk galt</returns>
    Task<Result> SendPasswordResetSmsAsync(string email, string ipAddress, CancellationToken ct = default);

    /// <summary>
    /// Steg 3b: Validerer SMS-koden for passord-reset.
    /// Krever at PasswordResetEmailVerified == true (steg 2 er fullført).
    /// Ved suksess settes SmsPasswordResetVerified = true, som låser opp steg 4.
    /// </summary>
    /// <param name="email">E-posten til brukeren</param>
    /// <param name="code">6-sifret SMS-kode</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <param name="ct"></param>
    /// <returns>Result med Success hvis koden er korrekt, ellers Failure</returns>
    Task<Result> VerifyPasswordResetSmsAsync(string email, string code, string ipAddress,
        CancellationToken ct = default);

    /// <summary>
    /// Steg 4: Bytter passord.
    /// Krever at SmsPasswordResetVerified == true (steg 3b er fullført).
    /// SMS-koden valideres ikke her — den ble allerede verifisert i steg 3b.
    /// Nullstiller alle password-reset felter etter fullført bytte.
    /// </summary>
    /// <param name="email">E-posten til brukeren</param>
    /// <param name="newPassword">Det nye passordet</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <param name="ct"></param>
    /// <returns>Result med Success for frontend til å sende til Login-skjerm/side</returns>
    Task<Result> ResetPasswordAsync(string email, string newPassword, string ipAddress,
        CancellationToken ct = default);
}
