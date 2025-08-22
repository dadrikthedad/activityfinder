using Azure.Communication.Email;

namespace AFBack.Services;

public class EmailService
{
    private readonly EmailClient _emailClient;
    private readonly IConfiguration _configuration;
    private readonly string _fromEmail;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
        var connectionString = _configuration["AzureCommunication:ConnectionString"];
        _emailClient = new EmailClient(connectionString);
        _fromEmail = _configuration["Email:FromAddress"]; // f.eks. noreply@koptr.net
    }

    public async Task<bool> SendVerificationEmailAsync(string toEmail, string verificationToken)
    {
        try
        {
            var verificationLink = $"{_configuration["App:BaseUrl"]}/verify-email?token={verificationToken}";
            
            var emailContent = new EmailContent("Verifiser din epostadresse")
            {
                PlainText = $"Klikk på følgende lenke for å verifisere din epostadresse: {verificationLink}",
                Html = $@"
                    <h2>Velkommen til Koptr!</h2>
                    <p>Takk for at du registrerte deg. Klikk på lenken under for å verifisere din epostadresse:</p>
                    <p><a href='{verificationLink}' style='background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Verifiser epostadresse</a></p>
                    <p>Eller kopier og lim inn denne lenken i nettleseren din:</p>
                    <p>{verificationLink}</p>
                    <br>
                    <p>Med vennlig hilsen,<br>Koptr Team</p>
                "
            };

            var emailMessage = new EmailMessage(
                senderAddress: _fromEmail,
                content: emailContent,
                recipients: new EmailRecipients(new List<EmailAddress> { new EmailAddress(toEmail) }));

            var operation = await _emailClient.SendAsync(Azure.WaitUntil.Completed, emailMessage);
            
            // Forenklet success check
            return operation.HasValue && operation.Value.Status == EmailSendStatus.Succeeded;
        }
        catch (Exception ex)
        {
            // Log error - bruk proper logging i stedet for Console.WriteLine
            Console.WriteLine($"Email sending failed: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SendWelcomeEmailAsync(string toEmail, string userName)
    {
        try
        {
            var emailContent = new EmailContent($"Velkommen til Koptr, {userName}!")
            {
                PlainText = $"Hei {userName}!\n\nVelkommen til Koptr! Din konto er nå aktivert og klar til bruk.\n\nMed vennlig hilsen,\nKoptr Team",
                Html = $@"
                    <h2>Velkommen til Koptr, {userName}!</h2>
                    <p>Gratulerer! Din konto er nå aktivert og klar til bruk.</p>
                    <p>Du kan nå logge inn og begynne å bruke alle funksjonene i appen.</p>
                    <br>
                    <p>Med vennlig hilsen,<br>Koptr Team</p>
                "
            };

            var emailMessage = new EmailMessage(
                senderAddress: _fromEmail,
                content: emailContent,
                recipients: new EmailRecipients(new List<EmailAddress> { new EmailAddress(toEmail) }));

            var operation = await _emailClient.SendAsync(Azure.WaitUntil.Completed, emailMessage);
            
            return operation.HasValue && operation.Value.Status == EmailSendStatus.Succeeded;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Welcome email sending failed: {ex.Message}");
            return false;
        }
    }
}