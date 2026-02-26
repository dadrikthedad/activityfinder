using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Enums;

namespace AFBack.Infrastructure.Security.Services;

public interface IEmailRateLimitService
{
    /// <summary>
    /// Sjekker om en email kan sendes.
    /// Sjekker tre nivåer: IP-grense (delt) → cooldown (per type) → daglig grense (per type).
    /// </summary>
    /// <param name="emailType">Epost type: Verification eller Forgotten Password</param>
    /// <param name="emailAddress">E-posten vi skal sende til</param>
    /// <param name="ipAddress">IP-adressen hvis vi har den</param>
    Result CanSendEmail(EmailType emailType, string emailAddress, string? ipAddress = null);

    /// <summary>
    /// Registrerer at en email faktisk ble sendt. Kall dette ETTER vellykket sending.
    /// </summary>
    /// <param name="emailType">Type epost sendt</param>
    /// <param name="emailAddress">Brukeren som fikk tilsendt epost</param>
    /// <param name="ipAddress">IP-adressen som sendt epost</param>
    void RegisterEmailSent(EmailType emailType, string emailAddress, string? ipAddress = null);

    /// <summary>
    /// Fjerner cooldown for en spesifikk email-type og adresse.
    /// Kall ved vellykket verifisering eller passord-reset.
    /// </summary>
    /// <param name="emailType">Epost type</param>
    /// <param name="emailAddress">Eposten som skal fjernes dictionary</param>
    void ClearEmailAttempts(EmailType emailType, string emailAddress);

    /// <summary>
    /// Rydder utløpte entries fra alle dictionaries.
    /// Kalles av EmailRateLimitCleanupTask via MaintenanceCleanupService.
    /// </summary>
    void PerformCleanup();
}
