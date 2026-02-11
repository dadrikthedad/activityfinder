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
    
    // ======================== Passord ======================== 
    
    /// <summary>
    /// Genererer passord verifiseringskode (6-sifret) for app og weblenke.
    /// Lagrer koden i VerificationInfo og returnerer begge.
    /// </summary>
    /// <param name="userId"></param>
    /// <returns>6-sifret kode</returns>
    Task<string> GeneratePasswordResetAsync(string userId);
   

    /// <summary>
    /// Validerer en 6-sifret passord-reset kode. Sjekker at koden stemmer og ikke er utløpt.
    /// Returnerer Identity-tokenet som trengs for å faktisk resette passordet via UserManager.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å validere koden</param>
    /// <param name="code">En 6-sifret kode</param>
    /// <returns>Success hvis koden er korrekt eller så Failure</returns>
    Task<Result> ValidatePasswordResetCodeAsync(string userId, string code);
    
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
}
