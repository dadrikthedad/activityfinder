using AFBack.Common.Results;
using AFBack.Infrastructure.Sms.Enums;

namespace AFBack.Infrastructure.Security.Services;

public interface ISmsRateLimitService
{
    /// <summary>
    /// Sjekker om en SMS kan sendes.
    /// Sjekker tre nivåer: IP-grense (delt) → cooldown (per type) → daglig grense (per type).
    /// </summary>
    /// <param name="smsType">SMS-type: Verification</param>
    /// <param name="phoneNumber">Telefonnummeret vi skal sende til</param>
    /// <param name="ipAddress">IP-adressen hvis vi har den</param>
    Result CanSendSms(SmsType smsType, string phoneNumber, string? ipAddress = null);

    /// <summary>
    /// Registrerer at en SMS faktisk ble sendt. Kall dette ETTER vellykket sending.
    /// </summary>
    /// <param name="smsType">Type SMS sendt</param>
    /// <param name="phoneNumber">Telefonnummeret som fikk tilsendt SMS</param>
    /// <param name="ipAddress">IP-adressen som sendte SMS</param>
    void RegisterSmsSent(SmsType smsType, string phoneNumber, string? ipAddress = null);

    /// <summary>
    /// Fjerner cooldown for en spesifikk SMS-type og telefonnummer.
    /// Kall ved vellykket verifisering.
    /// </summary>
    /// <param name="smsType">SMS-type</param>
    /// <param name="phoneNumber">Telefonnummeret som skal fjernes fra dictionary</param>
    void ClearSmsAttempts(SmsType smsType, string phoneNumber);

    /// <summary>
    /// Rydder utløpte entries fra alle dictionaries.
    /// Kalles av CleanupTask via MaintenanceCleanupService.
    /// </summary>
    void PerformCleanup();
}
