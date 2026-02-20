using AFBack.Common.Results;


namespace AFBack.Features.Auth.Services;

public interface IVerificationService
{
    // ======================== Epost verifisiering ======================== 
    
    /// <summary>
    /// Genererer e-post verifiseringskode (6-sifret) for app og weblenke.
    /// Lagrer koden i VerificationInfo og returnerer.
    /// </summary>
    /// <param name="userId">Brukeren som får email med VerificationInfo</param>
    /// <returns>6-sifret kode</returns>
    Task<string> GenerateEmailVerificationAsync(string userId);
    
    /// <summary>
    /// Validerer en 6-sifret e-post verifiseringskode.
    /// Sjekker at koden stemmer og ikke er utløpt.
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="code">6-sifret kode</param>
    /// <returns>Success hvis vellyket validering, eller Failure hvis feil kode eller utløpt</returns>
    Task<Result> ValidateEmailCodeAsync(string userId, string code);
    
    // ======================== Sms verifisiering ======================== 
    
    /// <summary>
    /// Genererer telefon-verifiseringskode (6-sifret).
    /// Lagrer koden i VerificationInfo og returnerer.
    /// </summary>
    Task<string> GeneratePhoneVerificationAsync(string userId);

    /// <summary>
    /// Validerer en 6-sifret telefon-verifiseringskode.
    /// Sjekker forsøksbegrensning, utløp og at koden stemmer.
    /// </summary>
    Task<Result> ValidatePhoneCodeAsync(string userId, string code);
    
    // ======================== Passord reset — Epost (steg 1) ======================== 
    
    /// <summary>
    /// Genererer passord verifiseringskode (6-sifret) for app og weblenke for epost.
    /// Lagrer koden i VerificationInfo e.
    /// </summary>
    /// <param name="userId"></param>
    /// <returns>6-sifret kode</returns>
    Task<string> GenerateEmailPasswordResetAsync(string userId);
   

    /// <summary>
    /// Validerer en 6-sifret passord-reset kode. Sjekker at koden stemmer og ikke er utløpt.
    /// Returnerer Identity-tokenet som trengs for å faktisk resette passordet via UserManager.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å validere koden</param>
    /// <param name="code">En 6-sifret kode</param>
    /// <returns>Success hvis koden er korrekt eller så Failure</returns>
    Task<Result> ValidateEmailPasswordResetCodeAsync(string userId, string code);
    
    // ======================== Passord reset — SMS (steg 2) ======================== 
    
    /// <summary>
    /// Genererer 6-sifret SMS-kode for passord-reset (steg 2). Krever at PasswordResetEmailVerified == true.
    /// </summary>
    /// <param name="userId"></param>
    /// <returns>6-sifret kode</returns>
    Task<string> GenerateSmsPasswordResetCodeAsync(string userId);
    
    /// <summary>
    /// Validerer SMS password-reset koden (steg 2). Ved suksess settes PasswordResetSmsVerified = true,
    /// som tillater selve passordbytte i steg 3.
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="code">En 6-sifret kode</param>
    /// <returns>Success hvis koden er korrekt eller så Failure</returns>
    Task<Result> ValidateSmsPasswordResetCodeAsync(string userId, string code);
    
    // ======================== Bytte e-post — Steg 1: Verifisering av nåværende epost ========================

    /// <summary>
    /// Lagrer ny epost som pending og genererer verifiseringskode for NÅVÆRENDE epost (steg 1).
    /// Koden sendes til brukerens nåværende epostadresse for å bekrefte at de eier den.
    /// </summary>
    /// <param name="userId">Brukeren som bytter epost</param>
    /// <param name="newEmail">Ny epost som lagres som pending</param>
    /// <returns>6-sifret kode</returns>
    Task<string> GenerateOldEmailChangeCodeAsync(string userId, string newEmail);

    /// <summary>
    /// Validerer koden sendt til nåværende epost (steg 1 av epost-bytte).
    /// Ved suksess settes CurrentEmailChangeVerified = true, som låser opp steg 2.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å verifisere</param>
    /// <param name="code">6-sifret kode</param>
    /// <returns>Success med ny epostadresse hvis koden er korrekt, ellers Failure</returns>
    Task<Result<string>> ValidateOldEmailChangeCodeAsync(string userId, string code);

    // ======================== Bytte e-post — Steg 2: Verifisering av ny epost ========================

    /// <summary>
    /// Genererer verifiseringskode for NY epost (steg 2 av epost-bytte).
    /// Krever at CurrentEmailChangeVerified == true (steg 1 er fullført).
    /// Koden sendes til den NYE epostadressen.
    /// </summary>
    /// <param name="userId">Brukeren som bytter epost</param>
    /// <param name="newEmail">Ny epost</param>
    /// <returns>6-sifret kode</returns>
    Task<string> GenerateNewEmailChangeCodeAsync(string userId, string newEmail);

    /// <summary>
    /// Validerer koden for ny epost-verifisering (steg 2 av epost-bytte).
    /// Ved suksess returneres den nye epostadressen og alle pending-felter nullstilles.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å verifisere</param>
    /// <param name="code">6-sifret kode</param>
    /// <returns>Success med ny epostadresse hvis koden er korrekt, ellers Failure</returns>
    Task<Result<string>> ValidateNewEmailChangeCodeAsync(string userId, string code);

    // ======================== Bytte telefonnummer — Steg 1: Verifisering via epost ========================

    /// <summary>
    /// Lagrer nytt telefonnummer som pending og genererer verifiseringskode for epost (steg 1).
    /// Koden sendes til brukerens epost for å bekrefte at de eier kontoen.
    /// </summary>
    /// <param name="userId">Brukeren som bytter telefon</param>
    /// <param name="newPhoneNumber">Nytt telefonnummer som lagres som pending</param>
    /// <returns>6-sifret kode</returns>
    Task<string> GeneratePhoneChangeEmailCodeAsync(string userId, string newPhoneNumber);

    /// <summary>
    /// Validerer epost-koden sendt for telefon-bytte (steg 1).
    /// Ved suksess settes CurrentPhoneChangeVerified = true, som låser opp steg 2.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å verifisere</param>
    /// <param name="code">6-sifret kode</param>
    /// <returns>Success med nytt telefonnummer hvis koden er korrekt, ellers Failure</returns>
    Task<Result<string>> ValidatePhoneChangeEmailCodeAsync(string userId, string code);

    // ======================== Bytte telefonnummer — Steg 2: Verifisering av nytt nummer ========================

    /// <summary>
    /// Genererer SMS-kode for NYTT telefonnummer (steg 2 av telefon-bytte).
    /// Krever at CurrentPhoneChangeVerified == true (steg 1 er fullført).
    /// Koden sendes til det NYE telefonnummeret.
    /// </summary>
    /// <param name="userId">Brukeren som bytter telefon</param>
    /// <param name="newPhoneNumber">Nytt telefonnummer</param>
    /// <returns>6-sifret kode</returns>
    Task<string> GenerateNewPhoneChangeCodeAsync(string userId, string newPhoneNumber);

    /// <summary>
    /// Validerer SMS-koden for nytt telefonnummer (steg 2 av telefon-bytte).
    /// Ved suksess returneres det nye telefonnummeret og alle pending-felter nullstilles.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å verifisere</param>
    /// <param name="code">6-sifret kode</param>
    /// <returns>Success med nytt telefonnummer hvis koden er korrekt, ellers Failure</returns>
    Task<Result<string>> ValidateNewPhoneChangeCodeAsync(string userId, string code);
    
    // ======================== Sikkerhetsvarsling ========================

    /// <summary>
    /// Genererer et engangs security alert token og lagrer det i VerificationInfo.
    /// Returnerer tokenet for bruk i "This wasn't me"-lenke.
    /// </summary>
    /// <param name="userId">Brukeren som tokenet tilhører</param>
    /// <returns>Security alert token (GUID-streng)</returns>
    Task<string> GenerateSecurityAlertTokenAsync(string userId);

    /// <summary>
    /// Validerer et security alert token. Ved suksess nullstilles tokenet (engangsbruk)
    /// og alle pending-endringer (epost, telefon, passord-reset) slettes.
    /// </summary>
    /// <param name="token">Security alert token fra URL</param>
    /// <returns>UserId hvis tokenet er gyldig, ellers Failure</returns>
    Task<Result<string>> ValidateSecurityAlertTokenAsync(string token);
}
