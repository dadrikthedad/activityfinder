using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Infrastructure.Email.Models;
using Azure.Communication.Email;

namespace AFBack.Infrastructure.Email;

/// <summary>
/// Håndterer kun sending av e-post via Azure Communication Services.
/// Templates og innhold kommer ferdig rendret fra EmailTemplates.
/// </summary>
public class EmailService(
    EmailClient emailClient, 
    IConfiguration configuration, 
    ILogger<EmailService> logger) : IEmailService
{
    private readonly string _fromEmail = configuration["Email:FromAddress"]!;
    
    /// <inheritdoc />
    public async Task<Result> SendAsync(string toEmail, EmailBody body)
    {
        try
        {
            // Vi oppretter et EmailContent som er Azure sin modell for å pakke subject, HTML og plaintext.
            // Subject = emnelinje, html = body, plaintext = fallback hvis bruker har skrudd av HTML
            var emailContent = new EmailContent(body.Subject)
            {
                PlainText = body.PlainText,
                Html = body.Html
            };
            
            // Oppretter epostmeldingen med sender epost, innholdet og mottakere
            var emailMessage = new EmailMessage(
                senderAddress: _fromEmail,
                content: emailContent,
                recipients: new EmailRecipients(new List<EmailAddress> { new(toEmail) }));
            
            // Operation fungerer som et Result
            var operation = await emailClient.SendAsync(Azure.WaitUntil.Completed, emailMessage);
            
            // Finner ut hva som gikk galt ved sending av eposten. Brukeren får en standard medling med status
            if (!operation.HasValue || operation.Value.Status != EmailSendStatus.Succeeded)
            {
                var status = operation.HasValue ? operation.Value.Status.ToString() : "No response";
                logger.LogError("Email sending failed to {Email}. Status: {Status}", toEmail, status);
                return Result.Failure($"Email sending failed with status: {status}", 
                    ErrorTypeEnum.InternalServerError);
            }

            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError("Email sending failed to {Email}: {Error}", toEmail, ex.Message);
            return Result.Failure("Failed to send email", ErrorTypeEnum.InternalServerError);
        }
    }
}
