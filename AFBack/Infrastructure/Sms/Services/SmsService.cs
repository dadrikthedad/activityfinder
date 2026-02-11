using AFBack.Common.Enum;
using AFBack.Common.Results;
using Azure.Communication.Sms;

namespace AFBack.Infrastructure.Sms.Services;

/// <summary>
/// Håndterer kun sending av SMS via Azure Communication Services.
/// Ren transport — ingen rate limiting, kode-generering eller forretningslogikk.
/// </summary>
public class SmsService(
    SmsClient smsClient,
    IConfiguration configuration,
    ILogger<SmsService> logger) : ISmsService
{
    private readonly string _fromPhone = configuration["Sms:FromNumber"]!;

    /// <inheritdoc />
    public async Task<Result> SendAsync(string phoneNumber, string message)
    {
        try
        {
            var response = await smsClient.SendAsync(
                from: _fromPhone,
                to: phoneNumber,
                message: message);

            if (!response.Value.Successful)
            {
                logger.LogError(
                    "SMS sending failed to {Phone}. Status: {Status}, Error: {Error}",
                    phoneNumber, response.Value.HttpStatusCode, response.Value.ErrorMessage);
                return Result.Failure("SMS sending failed", ErrorTypeEnum.InternalServerError);
            }

            logger.LogInformation("SMS sent successfully to {Phone}", phoneNumber);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError("SMS sending failed to {Phone}: {Error}", phoneNumber, ex.Message);
            return Result.Failure("Failed to send SMS", ErrorTypeEnum.InternalServerError);
        }
    }
}
