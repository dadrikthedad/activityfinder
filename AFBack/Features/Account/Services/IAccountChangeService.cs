using AFBack.Common.Results;

namespace AFBack.Features.Account.Services;

/// <summary>
/// Håndterer endring av epost og telefonnummer for innloggede brukere,
/// samt "This wasn't me"-rapportering med kontolåsing og rollback.
/// </summary>
public interface IAccountChangeService
{
    // ======================== Bytte e-post (3 steg - innlogget ) ======================== 

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

    // ======================== Bytte telefonnummer (3 steg) ======================== 

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
    
    // ======================== Bytte navn ======================== 
    
    /// <summary>
    /// 
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="firstName"></param>
    /// <param name="lastName"></param>
    /// <returns></returns>
    Task<Result> ChangeNameAsync(string userId, string firstName, string lastName);
}
