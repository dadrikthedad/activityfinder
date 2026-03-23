using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Email.Templates;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Sms.Enums;
using AFBack.Infrastructure.Sms.Services;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Auth.Services;

public class PasswordService(
    UserManager<AppUser> userManager,
    ILogger<PasswordService> logger,
    IConfiguration configuration,
    IVerificationInfoService verificationInfoService,
    IAccountVerificationService accountVerificationService,
    IEmailService emailService,
    ISmsService smsService,
    IEmailRateLimitService emailRateLimitService,
    ISmsRateLimitService smsRateLimitService,
    ISuspiciousActivityService suspiciousActivityService,
    IRateLimitGuardService rateLimitGuardService) : IPasswordService
{
    
    // ======================== Bytt passord (innlogget) ======================== 

    /// <inheritdoc/>
    public async Task<Result> ChangePasswordAsync(string userId, string currentPassword, string newPassword,
        CancellationToken ct = default)
    {
        logger.LogInformation("ChangePasswordAsync. UserId: {UserId}", userId);
    
        // Finn bruker
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Change password requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", AppErrorCode.NotFound);
        }
    
        // Valider gammelt passord
        var isCurrentPasswordValid = await userManager.CheckPasswordAsync(user, currentPassword);
        if (!isCurrentPasswordValid)
        {
            logger.LogWarning("Change password failed — wrong current password for UserId: {UserId}", userId);
            return Result.Failure("Current password is incorrect", AppErrorCode.InvalidCredentials);
        }
    
        // Bytt passord via Identity
        var changeResult = await userManager.ChangePasswordAsync(user, currentPassword, newPassword);
        if (!changeResult.Succeeded)
        {
            var errors = string.Join(" ", changeResult.Errors.Select(e => e.Description));
            logger.LogWarning("Failed to change password for UserId: {UserId}. Errors: {Errors}", 
                userId, errors);
            return Result.Failure(errors, AppErrorCode.InternalError);
        }
    
        logger.LogInformation("Password changed successfully for UserId: {UserId}", userId);
        return Result.Success();
    }
    
    // ======================== Steg 1: Forgot Password ======================== 
    
    /// <inheritdoc/>
    public async Task<Result> ForgotPasswordAsync(string email, string ipAddress, CancellationToken ct = default)
    {
        logger.LogInformation("ForgotPasswordAsync. Payload: {@Payload}", new { email });
    
        // ====== Rate limit — stopp spam av reset-eposter ======
        var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.PasswordReset, 
            email, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorCode);
    
        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
    
        // Returnerer success selv om bruker ikke finnes — forhindrer email enumeration
        if (user == null)
        {
            logger.LogWarning("Password reset requested for non-existent email: {Email}", email);
            return Result.Success();
        }
        
        // Brukeren har ikke bekrefet eposten sin
        if (!user.EmailConfirmed)
        {
            logger.LogInformation("Password reset redirected to verification for unverified email: {Email}", 
                email);
            await accountVerificationService.ResendVerificationEmailAsync(email, ipAddress, ct);
    
            return Result.Failure(
                "Your email is not yet verified. " +
                "We've sent a verification email — please verify before resetting your password.", 
                AppErrorCode.InvalidCredentials);
        }
        
        // Brukeren har ikke bekrefet eposten sin
        if (!user.PhoneNumberConfirmed)
        {
            logger.LogInformation("Password reset redirected to verification for unverified phonenumber: {Email}", 
                email);
            await accountVerificationService.ResendPhoneVerificationAsync(email, ipAddress, ct);
    
            return Result.Failure(
                "Your phonenumber is not yet verified. " +
                "We've sent a verification sms — please verify before resetting your password.", 
                AppErrorCode.PhoneNotConfirmed);
        }
        
        // ====== Generer kode og send epost ======
        var emailCode = await verificationInfoService.GenerateEmailPasswordResetAsync(user.Id, ct);
    
        var emailData = new EmailCodeDto(
            Email: email,
            Code: emailCode,
            BaseUrl: configuration["App:BaseUrl"]!);
    
        var body = EmailTemplates.PasswordReset(emailData);
    
        var result = await emailService.SendAsync(email, body, ct);
        if (result.IsSuccess)
            emailRateLimitService.RegisterEmailSent(EmailType.PasswordReset, email, ipAddress);
    
        return Result.Success();
    }
    
    // ======================== Steg 2: Verifiser epost-kode ========================
    
    /// <inheritdoc/>
    public async Task<Result> VerifyPasswordResetEmailCodeAsync(string email, string code, string ipAddress,
        CancellationToken ct = default)
    {
        logger.LogInformation("VerifyPasswordResetEmailCodeAsync. Payload: {@Payload}", new { email });
        
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            logger.LogWarning("IpAddress: {IpAddress} is trying to verify password reset code for " +
                              "non-existent user. Email: {Email}", ipAddress, email);
            return Result.Failure("Invalid reset attempt", AppErrorCode.Unauthorized);
        }
        
        var validateResult = await verificationInfoService.ValidateEmailPasswordResetCodeAsync(user.Id, code, ct);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorCode == AppErrorCode.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"Password reset email code locked out for {email}");
            
            return validateResult;
        }
        
        logger.LogInformation(
            "Password reset email code verified for {Email}. User can now request SMS code.", email);
        return Result.Success();
    }
    
    // ======================== Steg 3: Send SMS ========================
    
    /// <inheritdoc/>
    public async Task<Result> SendPasswordResetSmsAsync(string email, string ipAddress, CancellationToken ct = default)
    {
        logger.LogInformation("SendPasswordResetSmsAsync. Payload: {@Payload}", new { email });
        
        // Finn bruker
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            logger.LogWarning("IpAddress: {IpAddress} is trying to send password reset code for " +
                              "non-existent user. Email: {Email}", ipAddress, email);
            return Result.Failure("Invalid reset attempt", AppErrorCode.Unauthorized);
        }
        
        // Rate limit SMS
        var rateLimitResult = await rateLimitGuardService.CheckSmsRateLimitAsync(
            SmsType.PasswordReset, user.PhoneNumber!, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorCode);
        
        // Generer SMS-kode (guard i VerificationService sjekker PasswordResetEmailVerified)
        var smsCode = await verificationInfoService.GenerateSmsPasswordResetCodeAsync(user.Id, ct);
        
        var message = $"Your Koptr password reset code is: {smsCode}";
        var result = await smsService.SendAsync(user.PhoneNumber!, message, ct);
        
        if (result.IsSuccess)
            smsRateLimitService.RegisterSmsSent(SmsType.PasswordReset, user.PhoneNumber!, ipAddress);
        
        return Result.Success();
    }
    
    // ======================== Steg 4: Reset passord ========================
    
    /// <inheritdoc/>
    public async Task<Result> ResetPasswordAsync(string email, string code, string newPassword, string ipAddress,
        CancellationToken ct = default)
    {
        logger.LogInformation("ResetPasswordAsync. Payload: {@Payload}", new { email });
    
        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            logger.LogWarning("IpAddress: {IpAddress} is trying to verify sms password reset code for " +
                              "non-existent user. Email: {Email}", ipAddress, email);
            return Result.Failure("Invalid reset attempt", AppErrorCode.Unauthorized);
        }
    
        // ====== Valider koden ======
        var validateResult = await verificationInfoService.ValidateSmsPasswordResetCodeAsync(user.Id, code, ct);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorCode == AppErrorCode.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt, 
                    $"Password reset SMS code locked out for {email}");

            return validateResult;
        }
        
        var rateLimitResult = await rateLimitGuardService.CheckSmsRateLimitAsync(
            SmsType.PasswordReset, user.PhoneNumber!, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorCode);
        
        // ====== Reset passord via Identity ======
        // Fjern først
        var removeResult = await userManager.RemovePasswordAsync(user);
        if (!removeResult.Succeeded)
        {
            logger.LogError("Failed to remove password for {Email}", email);
            return Result.Failure("Failed to reset password", AppErrorCode.InternalError);
        }
        
        // Så legg til nytt Passord
        var addResult = await userManager.AddPasswordAsync(user, newPassword);
        if (!addResult.Succeeded)
        {
            var errors = string.Join(" ", addResult.Errors.Select(e => e.Description));
            logger.LogWarning("Failed to set new password for {Email}: {Errors}", email, errors);
            return Result.Failure(errors, AppErrorCode.InvalidRegistrationData);
        }
    
        // Nullstill rate limit cooldown for password reset
        emailRateLimitService.ClearEmailAttempts(EmailType.PasswordReset, email);
        smsRateLimitService.ClearSmsAttempts(SmsType.PasswordReset, user.PhoneNumber!);
        
        // ====== Opphev evt. lockout (f.eks. etter "This wasn't me"-rapportering) ======
        if (await userManager.IsLockedOutAsync(user))
        {
            await userManager.SetLockoutEndDateAsync(user, null);
            await userManager.ResetAccessFailedCountAsync(user);
            logger.LogInformation("Lockout cleared after successful password reset for {Email}", email);
        }
    
        logger.LogInformation("Password reset successful for {Email}", email);
        return Result.Success();
    }
}
