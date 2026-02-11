using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using LoginRequest = Microsoft.AspNetCore.Identity.Data.LoginRequest;

namespace AFBack.Features.Auth.Services;

public interface IAuthService
{
    // ======================== Signup ======================== 
    /// <summary>
    /// Registrerer en ny bruker med innsendt skjema i SignupRequest.
    /// Validerer epost og telefon, oppretter User og tilhørende modeller og sender verifikasjonsepost.
    /// </summary>
    /// <param name="request">SignupRequest</param>
    /// <param name="ipAddress">IP-adressen hentet fra forespørsel</param>
    /// <returns>SignupResponse</returns>
    Task<Result<SignupResponse>> SignupAsync(SignupRequest request, string ipAddress);
    
    
    // ======================== Login ======================== 
    /// <summary>
    /// Logger inn en bruker med epost og passord.
    /// Returnerer JWT-token ved suksess.
    /// </summary>
    Task<Result<LoginResponse>> LoginAsync(LoginRequest request);
    
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
    /// <param name="email"></param>
    /// <param name="code"></param>
    /// <param name="ipAddress"></param>
    /// <returns></returns>
    Task<Result> VerifyEmailAsync(string email, string code, string ipAddress);
    
    
    // ======================== Glemt passord ======================== 
    /// <summary>
    /// Sender passord-reset epost til brukeren. Validerer emailRateLimit og at brukeren eksisterer.
    /// Hvis bruker ikke har verifisert epost, så sender vi en ny verifiseringsepost.
    /// </summary>
    /// <param name="email">E-posten som ber om glemt passord</param>
    /// <param name="ipAddress">IP-adressen som ber om glemt passord</param>
    /// <returns>Result: Returnerer alltid success for å forhindre email enumeration</returns>
    Task<Result> ForgotPasswordAsync(string email, string ipAddress);

    
    /// <summary>
    /// Validerer reset-kode og setter nytt passord.
    /// </summary>
    Task<Result> ResetPasswordAsync(string email, string code, string newPassword, string ipAddress);
    
    // ======================== Sms verifisiering ======================== 
    
    /// <summary>
    /// Sender ny verifiserings-SMS til brukeren.
    /// Returnerer alltid success for å forhindre phone enumeration.
    /// </summary>
    Task<Result> ResendPhoneVerificationAsync(string phoneNumber, string ipAddress);

    /// <summary>
    /// Verifiserer brukerens telefonnummer med 6-sifret kode.
    /// Setter PhoneNumberConfirmed = true ved suksess.
    /// </summary>
    Task<Result> VerifyPhoneAsync(string phoneNumber, string code, string ipAddress);
    
    
}
