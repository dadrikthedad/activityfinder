using AFBack.Common.Results;

namespace AFBack.Infrastructure.Sms.Services;

public interface ISmsService
{
    /// <summary>
    /// Sender en SMS til et telefonnummer.
    /// Ren transport — ingen rate limiting eller forretningslogikk.
    /// </summary>
    /// <param name="phoneNumber">Telefonnummeret som skal motta SMS (med landskode)</param>
    /// <param name="message">Meldingsinnholdet</param>
    /// <param name="ct"></param>
    /// <returns>Result med Success hvis SMS ble sendt, eller Failure hvis noe gikk galt</returns>
    Task<Result> SendAsync(string phoneNumber, string message, CancellationToken ct = default);
}
