using AFBack.Infrastructure.Email.Models;
using static AFBack.Infrastructure.Email.Templates.EmailLayout;

namespace AFBack.Infrastructure.Email.Templates;

/// <summary>
/// E-postmaler for autentiseringsflyt (MFA, login-verifisering).
/// </summary>
public static class AuthEmailTemplate
{
    /// <summary>
    /// Bygger en MFA-kode epost som sendes til brukeren ved innlogging.
    /// </summary>
    public static EmailBody LoginMfa(EmailCodeDto emailDto)
    {
        var code = H(emailDto.Code);

        var bodyContent = $@"
            <h2 style='margin-top:0; color:#2d3748;'>Your login verification code</h2>
            <p style='color:#4a5568; font-size:16px; line-height:1.6;'>
                Use the code below to complete your login. The code will expire shortly.
            </p>

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
                    Enter this 6-digit code in the app to continue
                </p>
            </div>

            <hr style='margin:30px 0; border: none; border-top: 1px solid #e2e8f0;'>

            <p style='font-size:14px; color:#718096;'>
                If you did not attempt to log in, you can safely ignore this email.
                We recommend changing your password if you believe your account may be compromised.
            </p>";

        var html = Wrap("Login Verification", bodyContent,
            SupportFooter,
            $"© {DateTime.UtcNow.Year} ActivityFinder – If you didn't request this, you can ignore this email.");

        var plainText = $"Your login verification code\n\n" +
                        $"Enter this code to complete your login: {emailDto.Code}\n\n" +
                        $"The code will expire shortly.\n\n" +
                        $"If you did not attempt to log in, you can safely ignore this email.\n\n" +
                        $"Best regards,\nThe ActivityFinder Team";

        return new EmailBody("Your login verification code", html, plainText);
    }
}
