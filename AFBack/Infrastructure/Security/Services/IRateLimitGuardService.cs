
using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Sms.Enums;


namespace AFBack.Infrastructure.Security.Services;

public interface IRateLimitGuardService
{
    /// <summary>
    /// Sjekker om eposten ikke har blitt fanget opp av rate limit på endepunkter hvor det sendes epost. Epost er dyrt
    /// </summary>
    /// <param name="emailType">Type email som sendes - enum</param>
    /// <param name="email">Eposten</param>
    /// <param name="ipAddress">IP-addresse</param>
    /// <returns>Result med Success eller egen feilmelding</returns>
    Task<Result> CheckEmailRateLimitAsync(EmailType emailType, string email, string ipAddress);
    
    /// <summary>
    /// Sjekker om telefonnr ikke har blitt fanget opp av rate limit på endepunkter hvor det sendes sms. SMS er dyrt
    /// </summary>
    /// <param name="smsType">Type email som sendes - enum</param>
    /// <param name="phoneNumber">TelefonNr</param>
    /// <param name="ipAddress">IP-addresse</param>
    /// <returns>Result med Success eller egen feilmelding</returns>
    Task<Result> CheckSmsRateLimitAsync(SmsType smsType, string phoneNumber, string ipAddress);
    
    
}
