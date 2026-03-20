using AFBack.Common.Enum;
using AFBack.Common.Results;

namespace AFBack.Infrastructure.Sms.Services;

/// <summary>
/// Håndterer sending av SMS via 46elks API.
/// Tilsvarer SmsService (Azure Communication Services)
/// </summary>
public class SmsService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<SmsService> logger) : ISmsService
{
    private readonly string _fromNumber = configuration["Sms:FromNumber"]
                                          ?? throw new InvalidOperationException("Sms:FromNumber is not configured");

    /// <inheritdoc />
    public async Task<Result> SendAsync(string phoneNumber, string message)
    {
        try
        {
            var data = new List<KeyValuePair<string, string>>
            {
                new("from", _fromNumber),
                new("to", phoneNumber),
                new("message", message)
            };

            using var content = new FormUrlEncodedContent(data);
            var response = await httpClient.PostAsync("https://api.46elks.com/a1/sms", content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                logger.LogError("SMS sending failed to {Phone}. Status: {Status}. Error: {Error}",
                    phoneNumber, response.StatusCode, error);
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
