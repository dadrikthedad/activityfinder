using AFBack.Common.Results;

namespace AFBack.Features.Auth.Services.Interfaces;

/// <summary>
/// Høynivå-service for verifisering av epost og telefon ved registrering.
/// Koordinerer rate limiting, kode-generering via IVerificationCodeService, og utsending av epost/SMS.
/// </summary>
public interface IAccountVerificationService
{
    // ======================== Verification Email ======================== 
    /// <summary>
    /// Sender ny verifiseringsepost til en bruker som ikke har bekreftet eposten sin.
    /// Returnerer alltid success for å forhindre email enumeration.
    /// </summary>
    /// <param name="email">E-post til brukeren</param>
    /// <param name="ipAddress">IP-adressen fra forespørselen</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> ResendVerificationEmailAsync(string email, string ipAddress);
    
    /// <summary>
    /// Verifiserer brukerens epost med 6-sifret kode.
    /// Setter EmailConfirmed = true ved suksess.
    /// </summary>
    /// <param name="email">Eposten til brukeren</param>
    /// <param name="code">6-sifret kode</param>
    /// <param name="ipAddress">IP-adressen fra forespørselen</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> VerifyEmailAsync(string email, string code, string ipAddress);
    
    // ======================== Sms verifisiering ======================== 
    
    /// <summary>
    /// Sender ny verifiserings-SMS til brukeren.
    /// Returnerer alltid success for å forhindre phone enumeration.
    /// </summary>
    /// <param name="phoneNumber">Tlf til brukeren</param>
    /// <param name="ipAddress">IP-adressen fra forespørselen</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> ResendPhoneVerificationAsync(string phoneNumber, string ipAddress);

    /// <summary>
    /// Verifiserer brukerens telefonnummer med 6-sifret kode.
    /// Setter PhoneNumberConfirmed = true ved suksess.
    /// </summary>
    /// <param name="phoneNumber">Tlf til brukeren</param>
    /// <param name="code">6-sifret kode</param>
    /// <param name="ipAddress">IP-adressen fra forespørselen</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> VerifyPhoneAsync(string phoneNumber, string code, string ipAddress);
}
