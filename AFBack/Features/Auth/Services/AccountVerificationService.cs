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
using AFBack.Infrastructure.Transactions;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Auth.Services;

public class AccountVerificationService(
    UserManager<AppUser> userManager,
    ILogger<AccountVerificationService> logger,
    IVerificationInfoService verificationInfoService,
    IConfiguration configuration,
    IEmailService emailService,
    ISmsService smsService,
    IEmailRateLimitService emailRateLimitService,
    ISmsRateLimitService smsRateLimitService,
    ISuspiciousActivityService suspiciousActivityService,
    IRateLimitGuardService rateLimitGuardService,
    ITransactionService transactionService) : IAccountVerificationService
{
    // ======================== Email verifisiering ======================== 
    
    /// <inheritdoc/>
   public async Task<Result> ResendVerificationEmailAsync(string email, string ipAddress,
        CancellationToken ct = default)
   {
       logger.LogInformation("ResendVerificationEmailAsync. Payload: {@Payload}", new { email });
       
       // ====== Rate limit — stopp spam av verifiseringseposter ======
       var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.Verification, 
           email, ipAddress);
       if (rateLimitResult.IsFailure)
           return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorCode);
       
       // ====== Finn bruker ======
       var user = await userManager.FindByEmailAsync(email);
       
       // Returnerer success selv om bruker ikke finnes — forhindrer email enumeration
       if (user == null)
       {
           logger.LogWarning("Resend verification requested for non-existent email: {Email}", email);
           return Result.Success();
       }
       
       // Allerede verifisert — ingen grunn til å sende ny epost
       if (user.EmailConfirmed)
       {
           logger.LogInformation("Resend verification skipped — already confirmed: {Email}", email);
           return Result.Success();
       }
       
       // ====== Generer ny kode og send epost ======
       return await transactionService.ExecuteAsync(async (innerCt) =>
       {
           var code = await verificationInfoService.GenerateEmailVerificationAsync(user.Id, innerCt);
           
           var emailDto = new EmailCodeDto(
               Email: email,
               Code: code,
               BaseUrl: configuration["App:BaseUrl"]!);
           
           var body = EmailTemplates.Verification(emailDto);
           
           var result = await emailService.SendAsync(email, body, innerCt);
           if (result.IsFailure)
               return Result.Failure("Failed to send verification email. Please try again.",
                   result.ErrorCode);
           
           return Result.Success();
       }, ct);
   }
    
    /// <inheritdoc/>
    public async Task<Result> VerifyEmailAsync(string email, string code, string ipAddress, 
        CancellationToken ct = default)
    {
        logger.LogInformation("VerifyEmailAsync. Payload: {@Payload}", new { email });
    
        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
            return Result.Failure("Invalid verification attempt", AppErrorCode.Unauthorized);
    
        if (user.EmailConfirmed)
            return Result.Failure("Email is already verified", AppErrorCode.Conflict);
    
        // ====== Valider kode ======
        return await transactionService.ExecuteAsync(async (innerCt) =>
        {
            var validateResult = await verificationInfoService.ValidateEmailCodeAsync(user.Id, code, innerCt);
            if (validateResult.IsFailure)
            {
                // Rapporter mistenkelig aktivitet hvis brukeren er låst ute
                if (validateResult.ErrorCode == AppErrorCode.TooManyRequests)
                    await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                        SuspiciousActivityType.BruteForceAttempt,
                        $"Email verification locked out for {email}");

                return validateResult;
            }
        
            // ====== Marker epost som bekreftet ======
            user.EmailConfirmed = true;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
                logger.LogError("Failed to confirm email for {Email}: {Errors}", email, errors);
                return Result.Failure("Failed to verify email", AppErrorCode.InternalError);
            }
        
            // Nullstill rate limit cooldown for verification
            emailRateLimitService.ClearEmailAttempts(EmailType.Verification, email);
        
            logger.LogInformation("Email verified for {Email}", email);
            return Result.Success();
        }, ct);
    }
    
    // ======================== Sms verifisiering ======================== 
    
    /// <inheritdoc />
    public async Task<Result> ResendPhoneVerificationAsync(string email, string ipAddress,
        CancellationToken ct = default)
    {
        logger.LogInformation("ResendPhoneVerificationAsync called for {Email}", email);
    
        // ====== Finn bruker - må hente bruker først ======
        var user = await userManager.FindByEmailAsync(email);
        // Returnerer success selv om bruker ikke finnes — forhindrer phone enumeration
        if (user == null)
        {
            logger.LogWarning("Resend phone verification requested for non-existent email: {Email}", email);
            return Result.Success();
        }

        if (user.PhoneNumberConfirmed)
        {
            logger.LogInformation("Resend phone verification skipped — already confirmed: {Email}", email);
            return Result.Success();
        }
        
        // ====== Rate limit ======
        var rateLimitResult = await rateLimitGuardService.CheckSmsRateLimitAsync(SmsType.Verification, 
            user.PhoneNumber!, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorCode);
        
        // ====== Generer kode og send SMS ======
        return await transactionService.ExecuteAsync(async (innerCt) =>
        {
            var code = await verificationInfoService.GeneratePhoneVerificationAsync(user.Id, innerCt);

            var message = $"Your Lyn Software verification code is: {code}";
            var result = await smsService.SendAsync(user.PhoneNumber!, message, innerCt);

            if (result.IsFailure)
            {
                logger.LogError("Failed to send verification SMS to {Phone} for {Email}",
                    user.PhoneNumber, email);
                return Result.Failure("Failed to send SMS. Please try again.", AppErrorCode.InternalError);
            }

            smsRateLimitService.RegisterSmsSent(SmsType.Verification, user.PhoneNumber!, ipAddress);
            return Result.Success();
        }, ct);
    }
    
    /// <inheritdoc />
    public async Task<Result> VerifyPhoneAsync(string email, string code, string ipAddress, 
        CancellationToken ct = default)
    {
        logger.LogInformation("VerifyPhoneAsync called for {Email}", email);

        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
            return Result.Failure("Invalid verification attempt", AppErrorCode.Unauthorized);

        if (user.PhoneNumberConfirmed)
            return Result.Failure("Phone number is already verified", AppErrorCode.Conflict);

        // ====== Valider kode og marker telefon som bekreftet ======
        return await transactionService.ExecuteAsync(async (innerCt) =>
        {
            var validateResult = await verificationInfoService.ValidatePhoneCodeAsync(user.Id, code, innerCt);
            if (validateResult.IsFailure)
            {
                if (validateResult.ErrorCode == AppErrorCode.TooManyRequests)
                    await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                        SuspiciousActivityType.BruteForceAttempt,
                        $"Phone verification locked out for {user.PhoneNumber}");

                return validateResult;
            }

            // ====== Marker telefon som bekreftet ======
            user.PhoneNumberConfirmed = true;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
                logger.LogError("Failed to confirm phone for {Phone}: {Errors}", user.PhoneNumber, errors);
                return Result.Failure("Failed to verify phone number", AppErrorCode.InternalError);
            }

            smsRateLimitService.ClearSmsAttempts(SmsType.Verification, user.PhoneNumber!);

            logger.LogInformation("Phone verified for {Phone}", user.PhoneNumber);
            return Result.Success();
        }, ct);
    }
}
