using AFBack.Infrastructure.Email.Models;

namespace AFBack.Infrastructure.Email;

/// <summary>
/// Statisk klasse som rendrer e-postmaler. Ingen state, ingen avhengigheter.
/// Tar inn data og returnerer ferdig EmailBody med Subject, Html og PlainText.
/// </summary>
public static class EmailTemplates
{
    // Logo url
    private const string LogoUrlDefault = 
        "https://activitystorage.blob.core.windows.net/static/LogoMedSegoeUIHvit.png";

    /// <summary>
    /// Bygger en Verification epost template for å sende til brukeren.
    /// </summary>
    /// <param name="emailDto">VerificationEmailDto med VerificationToken, VerificationCode og baseUrl</param>
    /// <returns>EmailBody med subject, html og plaintext</returns>
    public static EmailBody Verification(VerificationEmailDto emailDto)
    {
        var verificationLink = $"{emailDto.BaseUrl}/verification?email={emailDto.Email}&code={emailDto.VerificationCode}";
        var logoUrl = LogoUrlDefault;

        var html = $@"
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
                            '>{emailDto.VerificationCode}</div>
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
            </html>";

        var plainText = $"Welcome to Koptr!\n\nThank you for signing up. Please verify your email address:\n\n" +
                        $"Option 1: Click this link: {verificationLink}\n\n" +
                        $"Option 2: Enter this code in the app: {emailDto.VerificationCode}\n\n" +
                        $"Best regards,\nthe team at Koptr.";

        return new EmailBody("Verify your Koptr account", html, plainText);
    }
    
    /// <summary>
    /// Bygger en Welcome epost template for å sende til brukeren etter vellykket verifiseringer
    /// </summary>
    /// <param name="emailDto">VerificationEmailDto med VerificationToken, VerificationCode og baseUrl</param>
    /// <returns>EmailBody med subject, html og plaintext</returns>
    public static EmailBody Welcome(WelcomeEmailDto emailDto)
    {
        var logoUrl = LogoUrlDefault;

        var html = $@"
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
                        <h2 style='margin-top:0; color:#2d3748;'>Welcome, {emailDto.UserName}!</h2>
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
            </html>";

        var plainText = $"Hi {emailDto.UserName}!\n\n" +
                        $"Welcome to Koptr! Your account is now active and ready to use.\n\n" +
                        $"You can now log in and start using all the features in the app.\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody($"Velkommen til Koptr, {emailDto.UserName}!", html, plainText);
    }
    
    /// <summary>
    /// Bygger en PasswordReset epost template for å sende til brukeren som har glemt passord
    /// </summary>
    /// <param name="emailDto">VerificationEmailDto med VerificationToken, VerificationCode og baseUrl</param>
    /// <returns>EmailBody med subject, html og plaintext</returns>
    public static EmailBody PasswordReset(PasswordResetEmailDto emailDto)
    {
        var resetLink = $"{emailDto.BaseUrl}/resetpassword?email={emailDto.Email}&code={emailDto.ResetCode}";
        var logoUrl = LogoUrlDefault;

        var html = $@"
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
                        <img src='{logoUrl}' alt='Koptr Logo' style='width:300px; margin-bottom:10px;'>
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
                            '>{emailDto.ResetCode}</div>
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
            </html>";

        var plainText = $"Hello!\n\nSomeone requested a password reset for your Koptr account.\n\n" +
                        $"Option 1 - Click this link:\n{resetLink}\n\n" +
                        $"Option 2 - Use this 6-digit code in the mobile app:\n{emailDto.ResetCode}\n\n" +
                        $"Both will expire in 1 hour. If you didn't request this, you can safely ignore this email.\n\n" +
                        $"Best regards,\nthe team at Koptr.";

        return new EmailBody("Reset your Koptr password", html, plainText);
    }
}
