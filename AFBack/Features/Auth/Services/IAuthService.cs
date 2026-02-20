using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;


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
    /// Prøver å logge inn en bruker med epost og passord.
    /// Bruker Identity til å validere brukeren, lockout og passord.
    /// Logger Historikk og UserDevice, og oppretter nye tokens
    /// </summary>
    /// <param name="request">LoginRequest</param>
    /// <param name="ipAddress">IP-addressen til brukeren</param>
    /// <param name="userAgent">UserAgent hvis det er en browser</param>
    /// <returns>Returnerer AccessToken og RefreshToken ved suksess.</returns>
    Task<Result<LoginResponse>> LoginAsync(LoginRequest request, string ipAddress, string? userAgent);
    
    
    // ======================== Logout ======================== 

    /// <summary>
    /// Logger ut bruker fra én device.
    /// Revokerer refresh token og blacklister access token i Redis.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="refreshToken">Refresh token som skal revokeres</param>
    /// <param name="accessTokenJti">JTI fra token</param>
    /// <param name="accessTokenExpiry">Expiry fra token</param>
    /// <param name="deviceId">DeviceId fra token</param>
    /// <returns>Result med Success</returns>
    Task<Result> LogoutAsync(string userId, string refreshToken, string accessTokenJti,
        DateTime accessTokenExpiry, int deviceId);

    /// <summary>
    /// Logger ut bruker fra alle devices.
    /// Revokerer alle refresh tokens og blacklister nåværende access token.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="accessTokenJti">JTI fra token</param>
    /// <param name="accessTokenExpiry">Expiry fra token</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> LogoutAllDevicesAsync(string userId, string accessTokenJti,
        DateTime accessTokenExpiry);
    
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
    
    
    // ======================== Glemt passord ======================== 
    
    /// <summary>
    /// Steg 1: Sender passord-reset epost med 6-sifret kode.
    /// Krever at brukerens epost og telefon er verifisert.
    /// Hvis bruker ikke har verifisert epost, så sender vi en ny verifiseringsepost.
    /// </summary>
    /// <param name="email">E-posten som ber om glemt passord</param>
    /// <param name="ipAddress">IP-adressen som ber om glemt passord</param>
    /// <returns>Result: Returnerer alltid success for å forhindre email enumeration</returns>
    Task<Result> ForgotPasswordAsync(string email, string ipAddress);
    
    /// <summary>
    /// Steg 2: Validerer epost-reset-koden.
    /// Ved suksess markeres PasswordResetEmailVerified = true,
    /// som låser opp muligheten til å sende SMS-kode.
    /// </summary>
    /// <param name="email">E-posten som prøver å verifisere</param>
    /// <param name="code">6-sifet kode fra brukeren</param>
    /// <param name="ipAddress">Brukerens IP-adresse</param>
    /// <returns>Result: Suksess ved riktig kode eller Failure hvis feil kode</returns>
    Task<Result> VerifyPasswordResetEmailCodeAsync(string email, string code, string ipAddress);

    /// <summary>
    /// Steg 3: Sender SMS-kode for passord-reset.
    /// Krever at PasswordResetEmailVerified == true (steg 2 er fullført).
    /// Validerer ikke brukerens telefonnummer, de har allerede bekreftet epost
    /// </summary>
    /// <param name="email">E-posten som prøver å verifisere</param>
    /// <param name="ipAddress">Brukerens IP-adresse</param>
    /// <returns>Result: Suksess ved sendt SMS eller Failure hvis noe gikk galt</returns>
    Task<Result> SendPasswordResetSmsAsync(string email, string ipAddress);
    
    /// <summary>
    /// Steg 4: Validerer SMS-koden og bytter passord.
    /// Krever at både PasswordResetEmailVerified og PasswordResetSmsVerified er true.
    /// Nullstiller alle password-reset felter etter fullført bytte.
    /// </summary>
    /// <param name="email">E-posten til brukeren</param>
    /// <param name="code">Brukerens kode</param>
    /// <param name="newPassword">Det nye passordet</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success for frontend til å sende til Login-skjerm/side</returns>
    Task<Result> ResetPasswordAsync(string email, string code, string newPassword, string ipAddress);
    
    // ======================== Bytt passord (innlogget) ======================== 
    
    /// <summary>
    /// Bytter passord for innlogget bruker.
    /// Krever at brukeren oppgir riktig nåværende passord.
    /// Ingen epost/SMS-verifisering nødvendig — bruker er allerede autentisert.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="currentPassword">Nåværende passord for å bekrefte identitet</param>
    /// <param name="newPassword">Nytt passord</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> ChangePasswordAsync(string userId, string currentPassword, string newPassword);
    
    
    // ======================== Bytte e-post (innlogget) ======================== 

    /// <summary>
    /// Steg 1: Starter epost-bytte for innlogget bruker.
    /// Validerer passord, sjekker at ny epost ikke er i bruk,
    /// lagrer ny epost som pending og sender kode til NY epost.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="currentPassword">Nåværende passord for å bekrefte identitet</param>
    /// <param name="newEmail">Den nye epostadressen brukeren ønsker</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> RequestEmailChangeAsync(string userId, string currentPassword, string newEmail, string ipAddress);
    
    /// <summary>
    /// Steg 2: Verifiserer koden sendt til nåværende epost.
    /// Ved suksess sendes verifiseringskode til den NYE epostadressen.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="code">6-sifret kode fra nåværende epost</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> VerifyCurrentEmailForChangeAsync(string userId, string code, string ipAddress);
    
    /// <summary>
    /// Steg 3: Verifiserer koden sendt til ny epost.
    /// Ved suksess oppdateres AppUser.Email og gammel epost lagres i PreviousEmail.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="code">6-sifret kode fra den nye epostadressen</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> VerifyEmailChangeAsync(string userId, string code, string ipAddress);

    // ======================== Bytte telefonnummer (innlogget) ======================== 

    /// <summary>
    /// Steg 1: Starter telefonnummer-bytte for innlogget bruker.
    /// Validerer passord, sjekker at nytt nummer ikke er i bruk,
    /// lagrer nytt nummer som pending og sender kode + alert til brukerens epost.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="currentPassword">Nåværende passord for å bekrefte identitet</param>
    /// <param name="newPhoneNumber">Det nye telefonnummeret brukeren ønsker</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> RequestPhoneChangeAsync(string userId, string currentPassword, 
        string newPhoneNumber, string ipAddress);
    
    /// <summary>
    /// Steg 2: Verifiserer epost-koden for telefon-bytte.
    /// Ved suksess sendes SMS-kode til det NYE telefonnummeret.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="code">6-sifret kode fra epost</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> VerifyCurrentEmailForPhoneChangeAsync(string userId, string code, string ipAddress);

    /// <summary>
    /// Steg 3: Verifiserer SMS-koden sendt til nytt telefonnummer.
    /// Ved suksess oppdateres AppUser.PhoneNumber og gammelt nummer lagres i PreviousPhoneNumber.
    /// </summary>
    /// <param name="userId">Brukerens ID fra JWT-token</param>
    /// <param name="code">6-sifret kode fra det nye telefonnummeret</param>
    /// <param name="ipAddress">IP-adressen til brukeren</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> VerifyPhoneChangeAsync(string userId, string code, string ipAddress);
    
    
    // ======================== Sikkerhetsvarsling ========================

    /// <summary>
    /// Håndterer "This wasn't me"-forespørsler fra sikkerhetsvarslings-eposter.
    /// Validerer tokenet, låser kontoen, nullstiller alle pending-endringer,
    /// og sender passord-reset epost til brukeren.
    /// </summary>
    /// <param name="token">Security alert token fra URL</param>
    /// <param name="ipAddress">IP-adressen til den som klikket lenken</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> ReportUnauthorizedChangeAsync(string token, string ipAddress);
    
   
}
