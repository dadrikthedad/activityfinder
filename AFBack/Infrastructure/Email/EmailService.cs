using System.Text;
using System.Text.Json;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Models;


namespace AFBack.Infrastructure.Email;

/// <summary>
/// Håndterer kun sending av e-post via Azure Communication Services.
/// Templates og innhold kommer ferdig rendret fra EmailTemplates.
/// </summary>
public class EmailService(
    HttpClient httpClient, 
    IConfiguration configuration, 
    ILogger<EmailService> logger) : IEmailService
{
    private readonly string _fromEmail = configuration["Email:FromAddress"]
                                         ?? throw new InvalidOperationException("Email:FromAddress is not configured");
    
    /// <inheritdoc />
    public async Task<Result> SendAsync(string toEmail, EmailBody body)
    {
        try
        {
            // API-format forventet av Brevo
            var payload = new
            {
                sender = new { email = _fromEmail },
                to = new[] { new { email = toEmail } },
                subject = body.Subject,
                htmlContent = body.Html,
                textContent = body.PlainText
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("https://api.brevo.com/v3/smtp/email", content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                logger.LogError("Brevo email sending failed to {Email}. Status: {Status}. Error: {Error}",
                    toEmail, response.StatusCode, error);
                return Result.Failure($"Email sending failed with status: {response.StatusCode}",
                    ErrorTypeEnum.InternalServerError);
            }

            logger.LogInformation("Successfully sent email to {Email}", toEmail);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError("Email sending failed to {Email}: {Error}", toEmail, ex.Message);
            return Result.Failure("Failed to send email", ErrorTypeEnum.InternalServerError);
        }
    }
}

