using AFBack.Infrastructure.Email.Models;
using static AFBack.Infrastructure.Email.Templates.EmailLayout;

namespace AFBack.Infrastructure.Email.Templates;

/// <summary>
/// Statisk klasse som rendrer e-postmaler for autentisering og kontosikkerhet.
/// Bruker EmailLayout.Wrap() for felles header/footer og H()/U() for input-sanitering.
/// </summary>
public static class EmailTemplates
{
    /// <summary>
    /// Bygger en Verification epost template for å sende til brukeren.
    /// </summary>
    public static EmailBody Verification(EmailCodeDto emailDto)
    {
        var verificationLink = $"{emailDto.BaseUrl}/verification?email={U(emailDto.Email)}&code={U(emailDto.Code)}";
        var code = H(emailDto.Code);

        var bodyContent = $@"
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
                '>{code}</div>
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

            <p style='font-size:14px; color:#718096; margin-top:20px;'>
                If you didn't sign up for Koptr, you can safely ignore this email. The account will not be activated without verification.
            </p>";

        var html = Wrap("Verify Email", bodyContent,
            SupportFooter,
            "© 2025 Koptr – If you didn't request this, you can ignore the email.");

        var plainText = $"Welcome to Koptr!\n\nThank you for signing up. Please verify your email address:\n\n" +
                        $"Option 1: Click this link: {verificationLink}\n\n" +
                        $"Option 2: Enter this code in the app: {emailDto.Code}\n\n" +
                        $"If you didn't sign up for Koptr, you can safely ignore this email. " +
                        $"The account will not be activated without verification.\n\n" +
                        $"Best regards,\nthe team at Koptr.";

        return new EmailBody("Verify your Koptr account", html, plainText);
    }

    /// <summary>
    /// Bygger en Welcome epost template for å sende til brukeren etter vellykket verifisering.
    /// </summary>
    public static EmailBody Welcome(WelcomeEmailDto emailDto)
    {
        var userName = H(emailDto.UserName);

        var bodyContent = $@"
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
            </p>";

        var html = Wrap("Welcome to Koptr", bodyContent,
            SupportFooter,
            "© 2025 Koptr – Welcome to the family!");

        var plainText = $"Hi {emailDto.UserName}!\n\n" +
                        $"Welcome to Koptr! Your account is now active and ready to use.\n\n" +
                        $"You can now log in and start using all the features in the app.\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody($"Velkommen til Koptr, {emailDto.UserName}!", html, plainText);
    }

    /// <summary>
    /// Bygger en PasswordReset epost template for å sende til brukeren som har glemt passord.
    /// </summary>
    public static EmailBody PasswordReset(EmailCodeDto emailDto)
    {
        var resetLink = $"{emailDto.BaseUrl}/resetpassword?email={U(emailDto.Email)}&code={U(emailDto.Code)}";
        var code = H(emailDto.Code);

        var bodyContent = $@"
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
                '>{code}</div>
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
                We will never ask for your password by email. This link and code will expire 
                for your security. An additional SMS verification will be required to complete 
                the password reset.
            </p>

            <p style='font-size:14px; color:#718096;'>
                If you didn't request this, you can safely ignore this email — no changes 
                have been made to your account.
            </p>";

        var html = Wrap("Reset Password", bodyContent,
            SupportFooter,
            "© 2025 Koptr – If you didn't request this, you can ignore the email.");

        var plainText = $"Hello!\n\nSomeone requested a password reset for your Koptr account.\n\n" +
                        $"Option 1 - Click this link:\n{resetLink}\n\n" +
                        $"Option 2 - Use this 6-digit code in the mobile app:\n{emailDto.Code}\n\n" +
                        $"Both will expire in 1 hour. If you didn't request this, you can safely ignore this email.\n\n" +
                        $"Best regards,\nthe team at Koptr.";

        return new EmailBody("Reset your Koptr password", html, plainText);
    }

    /// <summary>
    /// Bygger en epost-template for konto som er låst etter "This wasn't me"-rapportering.
    /// </summary>
    public static EmailBody AccountLocked(EmailCodeDto emailDto)
    {
        var resetLink = $"{emailDto.BaseUrl}/resetpassword?email={U(emailDto.Email)}&code={U(emailDto.Code)}";
        var code = H(emailDto.Code);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>🔒 Your Account Has Been Secured</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                We received a report of unauthorized activity on your account. 
                To protect you, we've taken the following actions:
            </p>

            <!-- Status box -->
            <div style='
                background-color:#fef2f2; 
                border:2px solid #dc2626; 
                border-radius:8px; 
                padding:20px; 
                margin:25px 0;
            '>
                <p style='color:#4a5568; font-size:14px; margin:0 0 8px 0;'>
                    ✅ All pending account changes have been cancelled
                </p>
                <p style='color:#4a5568; font-size:14px; margin:0 0 8px 0;'>
                    ✅ Your account has been locked for 24 hours
                </p>
                <p style='color:#4a5568; font-size:14px; margin:0;'>
                    ⚠️ You must reset your password to regain access
                </p>
            </div>

            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                Use one of the methods below to reset your password. 
                Once your password is reset, the lockout will be lifted and you can log in again.
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
                '>{code}</div>
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
                We will never ask for your password by email. This link and code will expire 
                for your security. An additional SMS verification will be required to complete 
                the password reset.
            </p>";

        var html = Wrap("Account Secured", bodyContent,
            SupportFooter,
            "© 2025 Koptr – We take your security seriously.");

        var plainText = $"ACCOUNT SECURED\n\n" +
                        $"We received a report of unauthorized activity on your Koptr account.\n\n" +
                        $"Actions taken:\n" +
                        $"- All pending account changes have been cancelled\n" +
                        $"- Your account has been locked for 24 hours\n" +
                        $"- You must reset your password to regain access\n\n" +
                        $"Option 1 - Click this link:\n{resetLink}\n\n" +
                        $"Option 2 - Use this 6-digit code in the app:\n{emailDto.Code}\n\n" +
                        $"Once your password is reset, the lockout will be lifted.\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody("🔒 Your Koptr account has been locked — reset your password", html, plainText);
    }

    /// <summary>
    /// Bygger en kombinert verifisering + security alert epost for epost-bytte.
    /// Sendes til brukerens NÅVÆRENDE epost (steg 1).
    /// </summary>
    public static EmailBody EmailChangeVerification(EmailChangeVerificationDto emailDto)
    {
        var newEmail = H(emailDto.NewEmail);
        var code = H(emailDto.VerificationCode);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>Confirm Email Change</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                A request was made to change your Koptr email address to:
            </p>
            <p style='
                font-size:16px; 
                font-weight:bold; 
                color:#1C6B1C; 
                background:#f0fdf4; 
                padding:12px 16px; 
                border-radius:6px; 
                border:1px solid #1C6B1C;
                text-align:center;
            '>{newEmail}</p>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                To proceed, enter the code below in the app:
            </p>

            <!-- Manual Code -->
            <div style='text-align:center; margin:30px 0;'>
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
                '>{code}</div>
                <p style='font-size:14px; color:#718096; margin-top:10px;'>
                    Enter this 6-digit code in the Koptr app to confirm the change
                </p>
            </div>

            <p style='font-size:14px; color:#718096;'>
                After confirming, a second verification will be sent to the new email address.
            </p>

            <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

            <!-- Security Alert -->
            <div style='
                background-color:#fef2f2; 
                border:2px solid #dc2626; 
                border-radius:8px; 
                padding:20px; 
                margin:30px 0;
                text-align:center;
            '>
                <h3 style='color:#dc2626; margin-top:0; margin-bottom:10px;'>Didn't request this?</h3>
                <p style='color:#4a5568; font-size:14px; margin-bottom:20px;'>
                    If you did not request this change, click below to lock your account 
                    and cancel any pending changes immediately.
                </p>
                <a href='{emailDto.AlertUrl}' style='
                    background-color:#dc2626;
                    color:white;
                    text-decoration:none;
                    padding:14px 30px;
                    font-size:16px;
                    border-radius:6px;
                    display:inline-block;
                    font-weight:bold;
                '>This wasn't me — lock my account</a>
            </div>

            <p style='font-size:14px; color:#718096; margin-top:20px;'>
                This code will expire for your security.
            </p>";

        var html = Wrap("Confirm Email Change", bodyContent,
            SupportFooter,
            "© 2025 Koptr – We take your security seriously.");

        var plainText = $"Confirm Email Change\n\n" +
                        $"A request was made to change your Koptr email to: {emailDto.NewEmail}\n\n" +
                        $"Enter this code in the app to confirm: {emailDto.VerificationCode}\n\n" +
                        $"After confirming, a second verification will be sent to the new email.\n\n" +
                        $"DIDN'T REQUEST THIS?\n" +
                        $"Click this link to lock your account immediately: {emailDto.AlertUrl}\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody("Confirm your Koptr email change", html, plainText);
    }

    /// <summary>
    /// Bygger en epost-template for verifisering av ny epostadresse ved epost-bytte (steg 2).
    /// Sendes til den NYE epostadressen.
    /// </summary>
    public static EmailBody EmailChange(EmailCodeDto emailCodeDto)
    {
        var verificationLink = $"{emailCodeDto.BaseUrl}/verify-email-change?email={U(emailCodeDto.Email)}&code={U(emailCodeDto.Code)}";
        var code = H(emailCodeDto.Code);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>Verify Your New Email Address</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                You're almost done! Please verify this email address using one of the methods below:
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
                '>Verify New Email</a>
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
                '>{code}</div>
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
                This link and code will expire for your security.
            </p>

            <p style='font-size:14px; color:#718096;'>
                If you didn't request this, you can safely ignore this email.
            </p>";

        var html = Wrap("Verify New Email", bodyContent,
            SupportFooter,
            "© 2025 Koptr – If you didn't request this, you can ignore the email.");

        var plainText = $"Verify Your New Email Address\n\n" +
                        $"You're almost done! Verify this email using one of the methods below:\n\n" +
                        $"Option 1: Click this link: {verificationLink}\n\n" +
                        $"Option 2: Enter this code in the app: {emailCodeDto.Code}\n\n" +
                        $"If you didn't request this, you can safely ignore this email.\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody("Verify your new Koptr email address", html, plainText);
    }

    /// <summary>
    /// Bygger en kombinert verifisering + security alert epost for telefon-bytte.
    /// Sendes til brukerens NÅVÆRENDE epost (steg 1).
    /// </summary>
    public static EmailBody PhoneChangeVerification(PhoneChangeVerificationDto emailDto)
    {
        var newPhone = H(emailDto.NewPhoneNumber);
        var code = H(emailDto.VerificationCode);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>Confirm Phone Number Change</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                A request was made to change your Koptr phone number to:
            </p>
            <p style='
                font-size:16px; 
                font-weight:bold; 
                color:#1C6B1C; 
                background:#f0fdf4; 
                padding:12px 16px; 
                border-radius:6px; 
                border:1px solid #1C6B1C;
                text-align:center;
            '>{newPhone}</p>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                To proceed, enter the code below in the app:
            </p>

            <!-- Manual Code -->
            <div style='text-align:center; margin:30px 0;'>
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
                '>{code}</div>
                <p style='font-size:14px; color:#718096; margin-top:10px;'>
                    Enter this 6-digit code in the Koptr app to confirm the change
                </p>
            </div>

            <p style='font-size:14px; color:#718096;'>
                After confirming, an SMS verification will be sent to the new phone number.
            </p>

            <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

            <!-- Security Alert -->
            <div style='
                background-color:#fef2f2; 
                border:2px solid #dc2626; 
                border-radius:8px; 
                padding:20px; 
                margin:30px 0;
                text-align:center;
            '>
                <h3 style='color:#dc2626; margin-top:0; margin-bottom:10px;'>Didn't request this?</h3>
                <p style='color:#4a5568; font-size:14px; margin-bottom:20px;'>
                    If you did not request this change, click below to lock your account 
                    and cancel any pending changes immediately.
                </p>
                <a href='{emailDto.AlertUrl}' style='
                    background-color:#dc2626;
                    color:white;
                    text-decoration:none;
                    padding:14px 30px;
                    font-size:16px;
                    border-radius:6px;
                    display:inline-block;
                    font-weight:bold;
                '>This wasn't me — lock my account</a>
            </div>

            <p style='font-size:14px; color:#718096; margin-top:20px;'>
                This code will expire for your security.
            </p>";

        var html = Wrap("Confirm Phone Number Change", bodyContent,
            SupportFooter,
            "© 2025 Koptr – We take your security seriously.");

        var plainText = $"Confirm Phone Number Change\n\n" +
                        $"A request was made to change your Koptr phone number to: {emailDto.NewPhoneNumber}\n\n" +
                        $"Enter this code in the app to confirm: {emailDto.VerificationCode}\n\n" +
                        $"After confirming, an SMS verification will be sent to the new number.\n\n" +
                        $"DIDN'T REQUEST THIS?\n" +
                        $"Click this link to lock your account immediately: {emailDto.AlertUrl}\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody("Confirm your Koptr phone number change", html, plainText);
    }

    /// <summary>
    /// Bygger en sikkerhetsvarslings-epost som sendes til brukerens NÅVÆRENDE epost
    /// når noen ber om å bytte epost eller telefonnummer.
    /// </summary>
    public static EmailBody SecurityAlert(SecurityAlertEmailDto emailDto)
    {
        var changeType = H(emailDto.ChangeType);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>⚠️ Security Alert</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                Someone has requested to change the {changeType} on your Koptr account. 
                If this was you, no action is needed — simply complete the verification as normal.
            </p>

            <!-- Warning box -->
            <div style='
                background-color:#fef2f2; 
                border:2px solid #dc2626; 
                border-radius:8px; 
                padding:20px; 
                margin:30px 0;
                text-align:center;
            '>
                <h3 style='color:#dc2626; margin-top:0; margin-bottom:10px;'>Wasn't you?</h3>
                <p style='color:#4a5568; font-size:14px; margin-bottom:20px;'>
                    If you did not request this change, click the button below immediately. 
                    This will lock your account and cancel any pending changes.
                </p>
                <a href='{emailDto.SecurityAlertUrl}' style='
                    background-color:#dc2626;
                    color:white;
                    text-decoration:none;
                    padding:14px 30px;
                    font-size:16px;
                    border-radius:6px;
                    display:inline-block;
                    font-weight:bold;
                '>This wasn't me — lock my account</a>
            </div>

            <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

            <p style='font-size:14px; color:#718096;'>
                If the button doesn't work, paste this link into your browser:
            </p>
            <p style='font-size:13px; background:#edf2f7; padding:10px; border-radius:6px; word-break:break-all; font-family:monospace;'>
                {emailDto.SecurityAlertUrl}
            </p>

            <p style='font-size:14px; color:#718096; margin-top:20px;'>
                This link will expire in 24 hours. After locking your account, 
                we will send you instructions to reset your password and regain access.
            </p>";

        var html = Wrap("Security Alert", bodyContent,
            SupportFooter,
            "© 2025 Koptr – We take your security seriously.");

        var plainText = $"SECURITY ALERT\n\n" +
                        $"Someone has requested to change the {emailDto.ChangeType} on your Koptr account.\n\n" +
                        $"If this was you, no action is needed.\n\n" +
                        $"If this was NOT you, click this link immediately to lock your account:\n" +
                        $"{emailDto.SecurityAlertUrl}\n\n" +
                        $"This link expires in 24 hours. After locking your account, " +
                        $"we will send you instructions to reset your password.\n\n" +
                        $"Best regards,\nThe Koptr Team";

        return new EmailBody("⚠️ Security alert — change requested on your Koptr account", html, plainText);
    }
}
