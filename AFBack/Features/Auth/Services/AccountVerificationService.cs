using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
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

public class AccountVerificationService(
    UserManager<AppUser> userManager,
    ILogger<AccountVerificationService> logger,
    IVerificationInfoService verificationInfoService,
    IUserRepository userRepository,
    IConfiguration configuration,
    IEmailService emailService,
    ISmsService smsService,
    IEmailRateLimitService emailRateLimitService,
    ISmsRateLimitService smsRateLimitService,
    ISuspiciousActivityService suspiciousActivityService,
    IRateLimitGuardService rateLimitGuardService) : IAccountVerificationService
{
    // ======================== Email verifisiering ======================== 
    
    /// <inheritdoc/>
   public async Task<Result> ResendVerificationEmailAsync(string email, string ipAddress)
   {
       logger.LogInformation("ResendVerificationEmailAsync. Payload: {@Payload}", new { email });
       
       // ====== Rate limit — stopp spam av verifiseringseposter ======
       var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.Verification, 
           email, ipAddress);
       if (rateLimitResult.IsFailure)
           return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);
       
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
       var code = await verificationInfoService.GenerateEmailVerificationAsync(user.Id);
       
       var emailDto = new EmailCodeDto(
           Email: email,
           Code: code,
           BaseUrl: configuration["App:BaseUrl"]!);
       
       var body = EmailTemplates.Verification(emailDto);
       
       var result = await emailService.SendAsync(email, body);
       if (result.IsSuccess)
           emailRateLimitService.RegisterEmailSent(EmailType.Verification, email, ipAddress);
       
       return Result.Success();
   }
    
    /// <inheritdoc/>
    public async Task<Result> VerifyEmailAsync(string email, string code, string ipAddress)
    {
        logger.LogInformation("VerifyEmailAsync. Payload: {@Payload}", new { email });
    
        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
            return Result.Failure("Invalid verification attempt");
    
        if (user.EmailConfirmed)
            return Result.Failure("Email is already verified", ErrorTypeEnum.Conflict);
    
        // ====== Valider kode ======
        var validateResult = await verificationInfoService.ValidateEmailCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            // Rapporter mistenkelig aktivitet hvis brukeren er låst ute
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
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
            return Result.Failure("Failed to verify email");
        }
    
        // Nullstill rate limit cooldown for verification
        emailRateLimitService.ClearEmailAttempts(EmailType.Verification, email);
    
        logger.LogInformation("Email verified for {Email}", email);
        return Result.Success();
    }
    
    // ======================== Sms verifisiering ======================== 
    
    /// <inheritdoc />
    public async Task<Result> ResendPhoneVerificationAsync(string phoneNumber, string ipAddress)
    {
        logger.LogInformation("ResendPhoneVerificationAsync. Payload: {@Payload}", new { phoneNumber });

        // ====== Rate limit ======
        var rateLimitResult = await rateLimitGuardService.CheckSmsRateLimitAsync(SmsType.Verification, 
            phoneNumber, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);

        // ====== Finn bruker ======
        var user = await userRepository.FindByPhoneAsync(phoneNumber);

        // Returnerer success selv om bruker ikke finnes — forhindrer phone enumeration
        if (user == null)
        {
            logger.LogWarning("Resend phone verification requested for non-existent phone: {Phone}", phoneNumber);
            return Result.Success();
        }

        if (user.PhoneNumberConfirmed)
        {
            logger.LogInformation("Resend phone verification skipped — already confirmed: {Phone}", phoneNumber);
            return Result.Success();
        }

        // ====== Generer kode og send SMS ======
        var code = await verificationInfoService.GeneratePhoneVerificationAsync(user.Id);

        var message = $"Your Koptr verification code is: {code}";
        var result = await smsService.SendAsync(phoneNumber, message);

        if (result.IsSuccess)
            smsRateLimitService.RegisterSmsSent(SmsType.Verification, phoneNumber, ipAddress);

        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result> VerifyPhoneAsync(string phoneNumber, string code, string ipAddress)
    {
        logger.LogInformation("VerifyPhoneAsync. Payload: {@Payload}", new { phoneNumber });

        // ====== Finn bruker ======
        var user = await userRepository.FindByPhoneAsync(phoneNumber);
        if (user == null)
            return Result.Failure("Invalid verification attempt");

        if (user.PhoneNumberConfirmed)
            return Result.Failure("Phone number is already verified", ErrorTypeEnum.Conflict);

        // ====== Valider kode ======
        var validateResult = await verificationInfoService.ValidatePhoneCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"Phone verification locked out for {phoneNumber}");

            return validateResult;
        }

        // ====== Marker telefon som bekreftet ======
        user.PhoneNumberConfirmed = true;
        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            logger.LogError("Failed to confirm phone for {Phone}: {Errors}", phoneNumber, errors);
            return Result.Failure("Failed to verify phone number");
        }

        smsRateLimitService.ClearSmsAttempts(SmsType.Verification, phoneNumber);

        logger.LogInformation("Phone verified for {Phone}", phoneNumber);
        return Result.Success();
    }
}
