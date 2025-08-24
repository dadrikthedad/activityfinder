using Azure.Communication.Email;

namespace AFBack.Services;

public class EmailService
{
    private readonly EmailClient _emailClient;
    private readonly IConfiguration _configuration;
    private readonly string _fromEmail;
    private readonly ILogger<EmailService> _logger;
    
    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        var connectionString = _configuration["AzureCommunication:ConnectionString"];
        _emailClient = new EmailClient(connectionString);
        _fromEmail = _configuration["Email:FromAddress"]; // f.eks. noreply@koptr.net
        _logger = logger;
    }

   public string PreviewVerificationEmail(string toEmail, string verificationToken, string verificationCode)
    {
        var verificationLink = $"{_configuration["App:BaseUrl"]}/verification?token={verificationToken}";
        var logoUrl = "https://activitystorage.blob.core.windows.net/static/LogoMedSegoeUIHvit.png";

        return $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Verify Email</title>
            </head>
            <body style='margin:0; padding:20px; font-family:Segoe UI, sans-serif;'>

                <div style='max-width:600px; margin:0 auto;'>
                    
                    <!-- Header -->
                    <div style='background-color:#1C6B1C; padding:30px; text-align:center; border-top-left-radius:10px; border-top-right-radius:10px;'>
                        <img src='{logoUrl}' alt='Koptr Logo' style='width:120px; margin-bottom:10px;'>
                    </div>

                    <!-- Body -->
                    <div style='background-color:#ffffff; padding:40px 30px;'>
                        <h2 style='margin-top:0; color:#2d3748;'>Welcome to Koptr!</h2>
                        <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                            Thanks for signing up. Please verify your email address using one of the methods below:
                        </p>

                        <!-- Web Button -->
                        <div style='text-align:center; margin:30px 0;'>
                            <h3 style='color:#2d3748; margin-bottom:15px;'>Option 1: Click to verify</h3>
                            <a href='{verificationLink}' style='
                                background-color:#1C6B1C;
                                color:white;
                                text-decoration:none;
                                padding:14px 30px;
                                font-size:16px;
                                border-radius:6px;
                                display:inline-block;
                                font-weight:bold;
                            '>Verify on Web</a>
                        </div>

                        <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

                        <!-- Manual Code -->
                        <div style='text-align:center; margin:30px 0;'>
                            <h3 style='color:#2d3748; margin-bottom:15px;'>Option 2: Enter this code in the app</h3>
                            <div style='
                                font-size:32px; 
                                font-weight:bold; 
                                color:#1C6B1C; 
                                background:#f0fdf4; 
                                padding:20px; 
                                border-radius:8px; 
                                border:2px solid #1C6B1C;
                                letter-spacing:8px;
                                font-family:monospace;
                            '>{verificationCode}</div>
                            <p style='font-size:14px; color:#718096; margin-top:10px;'>
                                Enter this 6-digit code in the Koptr app
                            </p>
                        </div>

                        <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

                        <p style='font-size:14px; color:#718096;'>
                            If the button doesn't work, paste this link into your browser:
                        </p>
                        <p style='font-size:13px; background:#edf2f7; padding:10px; border-radius:6px; word-break:break-all; font-family:monospace;'>
                            {verificationLink}
                        </p>

                        <p style='font-size:14px; color:#718096; margin-top:20px;'>
                            We will never ask for your password by email. This link and code will expire for your security.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style='background-color:#1C6B1C; color:white; text-align:center; padding:20px; border-bottom-left-radius:10px; border-bottom-right-radius:10px; font-size:13px;'>
                        <p style='margin:0 0 8px 0;'>Need help? Contact <a href='mailto:support@koptr.net' style='color:#d1d5db;'>support@koptr.net</a></p>
                        <p style='margin:0;'>© 2025 Koptr – If you didn't request this, you can ignore the email.</p>
                    </div>

                </div>

            </body>
            </html>
        ";
    }

   public string PreviewWelcomeEmail(string toEmail, string userName)
    {
        var logoUrl = "https://activitystorage.blob.core.windows.net/static/LogoMedSegoeUIHvit.png";
        
        return $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Welcome to Koptr</title>
            </head>
            <body style='margin:0; padding:20px; font-family:Segoe UI, sans-serif;'>

                <div style='max-width:600px; margin:0 auto;'>
                    
                    <!-- Header -->
                    <div style='background-color:#1C6B1C; padding:30px; text-align:center; border-top-left-radius:10px; border-top-right-radius:10px;'>
                        <img src='{logoUrl}' alt='Koptr Logo' style='width:120px; margin-bottom:10px;'>
                    </div>

                    <!-- Body -->
                    <div style='background-color:#ffffff; padding:40px 30px;'>
                        <h2 style='margin-top:0; color:#2d3748;'>Welcome, {userName}!</h2>
                        <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                            Congratulations! Your email address has been verified and your account is now active.
                        </p>
                        <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                            You can now log in to the app with your email address and start messaging away as we await new features.
                        </p>

                        <div style='text-align:center; margin:40px 0; padding:20px; background:#f0fdf4; border-radius:6px;'>
                            <div style='font-size:48px; color:#1C6B1C; margin-bottom:10px;'>✓</div>
                            <p style='color:#1C6B1C; font-weight:bold; margin:0; font-size:18px;'>Email Verified Successfully!</p>
                        </div>

                        <hr style='margin:40px 0; border: none; border-top: 1px solid #e2e8f0;'>

                        <p style='font-size:14px; color:#718096;'>
                            Thank you for joining us at Koptr. We're excited to have you on board!
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style='background-color:#1C6B1C; color:white; text-align:center; padding:20px; border-bottom-left-radius:10px; border-bottom-right-radius:10px; font-size:13px;'>
                        <p style='margin:0 0 8px 0;'>Need help? Contact <a href='mailto:support@koptr.net' style='color:#d1d5db;'>support@koptr.net</a></p>
                        <p style='margin:0;'>© 2025 Koptr – Welcome to the family!</p>
                    </div>

                </div>

            </body>
            </html>
        ";
    }

    // Forgot Password Email (updated to match correct layout)
    public string PreviewForgotPasswordEmail(string toEmail, string resetToken, string resetCode)
    {
        var resetLink = $"{_configuration["App:BaseUrl"]}/resetpassword?token={resetToken}";
        var logoUrl = "https://activitystorage.blob.core.windows.net/static/LogoMedSegoeUIHvit.png";
        
        return $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Reset Password</title>
            </head>
            <body style='margin:0; padding:20px; font-family:Segoe UI, sans-serif;'>

                <div style='max-width:600px; margin:0 auto;'>
                    
                    <!-- Header -->
                    <div style='background-color:#1C6B1C; padding:30px; text-align:center; border-top-left-radius:10px; border-top-right-radius:10px;'>
                        <img src='{logoUrl}' alt='Koptr Logo' style='width:150px; margin-bottom:10px;'>
                    </div>

                    <!-- Body -->
                    <div style='background-color:#ffffff; padding:40px 30px;'>
                        <h2 style='margin-top:0; color:#2d3748;'>Reset Your Koptr Password</h2>
                        <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                            Someone requested a password reset for your account. Use one of the methods below to reset your password:
                        </p>

                        <!-- Web Button -->
                        <div style='text-align:center; margin:30px 0;'>
                            <h3 style='color:#2d3748; margin-bottom:15px;'>Option 1: Click to reset on web</h3>
                            <a href='{resetLink}' style='
                                background-color:#1C6B1C;
                                color:white;
                                text-decoration:none;
                                padding:14px 30px;
                                font-size:16px;
                                border-radius:6px;
                                display:inline-block;
                                font-weight:bold;
                            '>Reset Password</a>
                        </div>

                        <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

                        <!-- Manual Code -->
                        <div style='text-align:center; margin:30px 0;'>
                            <h3 style='color:#2d3748; margin-bottom:15px;'>Option 2: Enter this code in the app</h3>
                            <div style='
                                font-size:32px; 
                                font-weight:bold; 
                                color:#1C6B1C; 
                                background:#f0fdf4; 
                                padding:20px; 
                                border-radius:8px; 
                                border:2px solid #1C6B1C;
                                letter-spacing:8px;
                                font-family:monospace;
                            '>{resetCode}</div>
                            <p style='font-size:14px; color:#718096; margin-top:10px;'>
                                Enter this 6-digit code in the Koptr app to reset your password
                            </p>
                        </div>

                        <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

                        <p style='font-size:14px; color:#718096;'>
                            If the button doesn't work, paste this link into your browser:
                        </p>
                        <p style='font-size:13px; background:#edf2f7; padding:10px; border-radius:6px; word-break:break-all; font-family:monospace;'>
                            {resetLink}
                        </p>

                        <p style='font-size:14px; color:#718096; margin-top:20px;'>
                            We will never ask for your password by email. This link and code will expire in 1 hour for your security.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style='background-color:#1C6B1C; color:white; text-align:center; padding:20px; border-bottom-left-radius:10px; border-bottom-right-radius:10px; font-size:13px;'>
                        <p style='margin:0 0 8px 0;'>Need help? Contact <a href='mailto:support@koptr.net' style='color:#d1d5db;'>support@koptr.net</a></p>
                        <p style='margin:0;'>© 2025 Koptr – If you didn't request this, you can ignore the email.</p>
                    </div>
                </div>

            </body>
            </html>
        ";
    }

    // Eksisterende SendVerificationEmailAsync metode...
    public async Task<bool> SendVerificationEmailAsync(string toEmail, string verificationToken, string verificationCode)
    {
        try
        {
            var emailContent = new EmailContent("Verify your Koptr account")
            {
                PlainText = $"Welcome to Koptr!\n\nThank you for signing up. Please verify your email address:\n\nOption 1: Click this link: {_configuration["App:BaseUrl"]}/verification?token={verificationToken}\n\nOption 2: Enter this code in the app: {verificationCode}\n\nBest regards,\nthe team at Koptr.",
                Html = PreviewVerificationEmail(toEmail, verificationToken, verificationCode)
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
            _logger.LogError("Verification email sending failed to {Email}: {Error}", toEmail, ex.Message);
            return false;
        }
    }

    // Eksisterende SendWelcomeEmailAsync metode...
    public async Task<bool> SendWelcomeEmailAsync(string toEmail, string userName)
    {
        try
        {
            var logoUrl = "https://activitystorage.blob.core.windows.net/static/LogoMedSegoeUI.png";
            
            var emailContent = new EmailContent($"Velkommen til Koptr, {userName}!")
            {
                PlainText = $"Hei {userName}!\n\nVelkommen til Koptr! Din konto er nå aktivert og klar til bruk.\n\nDu kan nå logge inn og begynne å bruke alle funksjonene i appen.\n\nMed vennlig hilsen,\nKoptr Team",
                Html = PreviewWelcomeEmail(toEmail, userName)
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
            _logger.LogError("Welcome email sending failed to {Email}: {Error}", toEmail, ex.Message);
            return false;
        }
    }
    
    public async Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetToken, string resetCode)
    {
        try
        {
            var resetLink = $"{_configuration["App:BaseUrl"]}/reset-password?token={resetToken}";
        
            var emailContent = new EmailContent("Reset your Koptr password")
            {
                PlainText = $"Hello!\n\nSomeone requested a password reset for your Koptr account.\n\nOption 1 - Click this link:\n{resetLink}\n\nOption 2 - Use this 6-digit code in the mobile app:\n{resetCode}\n\nBoth will expire in 1 hour. If you didn't request this, you can safely ignore this email.\n\nBest regards,\nthe team at Koptr.",
                Html = PreviewForgotPasswordEmail(toEmail, resetToken, resetCode) // Oppdater denne
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
            _logger.LogError("Password reset email sending failed to {Email}: {Error}", toEmail, ex.Message);
            return false;
        }
    }
}