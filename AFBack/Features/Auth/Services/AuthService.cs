using AFBack.Common.Enum;
using AFBack.Common.Localization;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Sms.Enums;
using AFBack.Infrastructure.Sms.Services;
using AFBack.Models.Enums;
using Microsoft.AspNetCore.Identity;
using LoginRequest = Microsoft.AspNetCore.Identity.Data.LoginRequest;

namespace AFBack.Features.Auth.Services;

public class AuthService(
   UserManager<AppUser> userManager,
   ILogger<AuthService> logger,
   IJwtService jwtService,
   IUserRepository userRepository,
   IConfiguration configuration,
   IEmailService emailService,
   IVerificationService verificationService,
   IEmailRateLimitService emailRateLimitService,
   ISmsRateLimitService smsRateLimitService,
   ISmsService smsService,
   ISuspiciousActivityService suspiciousActivityService) : IAuthService
{
    /// <inheritdoc/>
   public async Task<Result<SignupResponse>> SignupAsync(SignupRequest request, string ipAddress)
   {
       logger.LogInformation("SignupAsync. Payload: {@Payload}", new {request.Email});
       
       // ====== IP-basert rate limit — stopp spam-registreringer tidlig ======
       
       // Sjekker om brukeren har spammet endepunktene våre tidligere
       var rateLimitResult = emailRateLimitService.CanSendEmail(EmailType.Verification, request.Email, ipAddress);
       if (rateLimitResult.IsFailure)
       {
           await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
               SuspiciousActivityType.EmailRateLimitExceeded,
               $"Signup email rate limit exceeded for {request.Email}");
           
           return Result<SignupResponse>.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
       }
       
       // ====== Validering ======
       var existingUserWithThisEmail = await userManager.FindByEmailAsync(request.Email);
       if (existingUserWithThisEmail != null)
       {
           await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
               SuspiciousActivityType.EmailEnumeration, 
               $"Attempted registration with existing email: {request.Email}");
    
           return Result<SignupResponse>.Failure(
               "A user with this email already exists", ErrorTypeEnum.Conflict);
       }

       var existingUserWithThisPhonenumber = await userRepository.FindByPhoneAsync(request.PhoneNumber);
       if (existingUserWithThisPhonenumber != null)
       {
           await suspiciousActivityService.ReportSuspiciousActivityAsync(
               ipAddress,
               SuspiciousActivityType.PhoneEnumeration,
               $"Attempted registration with existing phone: {request.PhoneNumber}");

           return Result<SignupResponse>.Failure(
               "A user with this phonenumber already exists", ErrorTypeEnum.Conflict);
       }
       
       // ====== Opprettelse ======
       
       // Oppretter User med UserProfile og UserSettings
       var user = new AppUser
       {
           UserName = request.Email,
           Email = request.Email,
           PhoneNumber = request.PhoneNumber,
           FirstName = request.FirstName,
           LastName = request.LastName,
           FullName = $"{request.FirstName} {request.LastName}",
           UserProfile = new UserProfile
           {
               DateOfBirth = request.DateOfBirth,
               Gender = request.Gender,
               CountryCode = request.CountryCode,
               Region = request.Region,
               PostalCode = request.PostalCode
           },
           UserSettings = new UserSettings
           {
               Language = LanguageMapper.FromCountry(request.CountryCode)
           },
           VerificationInfo = new VerificationInfo()
       };
       
       // Legger til brukerne
       var createUserResult = await userManager.CreateAsync(user, request.Password);
       if (!createUserResult.Succeeded)
       {
           var errors = string.Join(" ", createUserResult.Errors.Select(e => e.Description));
           logger.LogWarning("Failed to create user {Email}: {Errors}", request.Email, errors);
           return Result<SignupResponse>.Failure(errors);
       }
       
       // legger til roller
       var addRoleResult = await userManager.AddToRoleAsync(user, AppRoles.User);
       if (!addRoleResult.Succeeded)
       {
           await userManager.DeleteAsync(user);
           var errors = string.Join(" ", addRoleResult.Errors.Select(e => e.Description));
           logger.LogError("Failed to assign role {Role} to UserId: {UserId}. Errors: {Errors}", 
               AppRoles.User, user.Id, errors);
           return Result<SignupResponse>.Failure("An unexpected error occurred during signup");
       }
       
       // ====== Post-commit: Broadcast ======
       
       // Oppretter 6-sifret kode
       var code = await verificationService.GenerateEmailVerificationAsync(user.Id);
       
       // Kaller på Email service for å sende verifikasjons epost
       var emailDto = new VerificationEmailDto(
           Email: request.Email,
           VerificationCode: code,
           BaseUrl: configuration["App:BaseUrl"]!);
    
       // Bygger template
       var body = EmailTemplates.Verification(emailDto);
       
       // Sender epost - EmailService håndterer logging hvis noe går galt. Bekrefter epost sendt til RateLimit
       var result = await emailService.SendAsync(request.Email, body);
       if (result.IsSuccess)
           emailRateLimitService.RegisterEmailSent(EmailType.Verification, request.Email, ipAddress);
       
       // ====== Response ======
       var response = new SignupResponse
       {
           UserId = user.Id,
           EmailSent = result.IsSuccess
       };
       
       // returner UserId til frontend
       return Result<SignupResponse>.Success(response);
   }
    
    public async Task<Result<LoginResponse>> LoginAsync(LoginRequest request)
   {
       logger.LogInformation("LoginAsync. Payload: {@Payload}", new { request.Email });


       var user = await userManager.FindByEmailAsync(request.Email);
      
       if (user == null)
           logger.LogWarning("Login failed. User not found for {Email}", request.Email);
      
       if (user != null && await userManager.IsLockedOutAsync(user))
       {
           var lockoutEnd = await userManager.GetLockoutEndDateAsync(user);
           logger.LogWarning("Login failed. Account locked for {Email} until {LockoutEnd}",
               request.Email, lockoutEnd);
           return Result<LoginResponse>.Failure(
               "Your account has been locked due to multiple failed login attempts. " +
               "Please try again later.");
       }


       var targetUser = user ?? DummyUser;
      
       var isPasswordValid = await userManager.
           CheckPasswordAsync(targetUser, request.Password);
      
       if (user == null || !isPasswordValid)
       {
           if (user != null)
               await userManager.AccessFailedAsync(user);
          
           logger.LogWarning("Login failed. Invalid password for {Email}", request.Email);
           return Result<LoginResponse>.Failure("Wrong email or password");
       }
      
       // if (!user.EmailConfirmed)
       // {
       //     logger.LogWarning("Login failed. Email not confirmed for {Email}", request.Email);
       //     return Result<LoginResponse>.Failure("Please confirm your email before logging in",
       //         ErrorTypeEnum.Unauthorized);
       // }
      
       await userManager.ResetAccessFailedCountAsync(user);
      
       var roles = await userManager.GetRolesAsync(user);
       var token = jwtService.GenerateJwtToken(user.Id, request.Email, roles);


       var loginResponse = new LoginResponse
       {
           UserId = user.Id,
           Email = request.Email,
           Name = user.FullName,
           Token = token
       };


       return Result<LoginResponse>.Success(loginResponse);
   }
  
   private static readonly AppUser DummyUser = new ()
   {
       Id = "00000000-0000-0000-0000-000000000000",
       UserName = "dummy@example.com",
       NormalizedUserName = "DUMMY@EXAMPLE.COM",
       Email = "dummy@example.com",
       NormalizedEmail = "DUMMY@EXAMPLE.COM",
       PasswordHash = "rOvscqlQVuUAtxqrUuyWZLRUHAUs1BDZm2k02/Y+IKgoxH9X8Ac/TvsP5oyMaMOk"
   };
    
    /// <inheritdoc/>
    public async Task<Result> ResendVerificationEmailAsync(string email, string ipAddress)
    {
        logger.LogInformation("ResendVerificationEmailAsync. Payload: {@Payload}", new { email });
       
        // ====== Rate limit — stopp spam av verifiseringseposter ======
        var rateLimitResult = emailRateLimitService.CanSendEmail(EmailType.Verification, email, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.EmailRateLimitExceeded,
                $"Resend verification rate limit exceeded for {email}");
           
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
       
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
        var code = await verificationService.GenerateEmailVerificationAsync(user.Id);
       
        var emailDto = new VerificationEmailDto(
            Email: email,
            VerificationCode: code,
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
        var validateResult = await verificationService.ValidateEmailCodeAsync(user.Id, code);
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

    
    /// <inheritdoc/>
    public async Task<Result> ForgotPasswordAsync(string email, string ipAddress)
    {
        logger.LogInformation("ForgotPasswordAsync. Payload: {@Payload}", new { email });
    
        // ====== Rate limit — stopp spam av reset-eposter ======
        var rateLimitResult = emailRateLimitService.CanSendEmail(EmailType.PasswordReset, email, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(
                ipAddress,
                SuspiciousActivityType.EmailRateLimitExceeded,
                $"Password reset rate limit exceeded for {email}");
        
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
    
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
            await ResendVerificationEmailAsync(email, ipAddress);
    
            return Result.Failure(
                "Your email is not yet verified. " +
                "We've sent a verification email — please verify before resetting your password.");
        }
        
        // Brukeren har ikke bekrefet eposten sin
        if (!user.PhoneNumberConfirmed)
        {
            logger.LogInformation("Password reset redirected to verification for unverified phonenumber: {Email}", 
                email);
            await ResendPhoneVerificationAsync(user.PhoneNumber!, ipAddress);
    
            return Result.Failure(
                "Your phonenumber is not yet verified. " +
                "We've sent a verification sms — please verify before resetting your password.");
        }
        
        // ====== Generer kode og send epost ======
        var emailCode = await verificationService.GeneratePasswordResetAsync(user.Id);
    
        var emailData = new PasswordResetEmailDto(
            Email: email,
            ResetCode: emailCode,
            BaseUrl: configuration["App:BaseUrl"]!);
    
        var body = EmailTemplates.PasswordReset(emailData);
    
        var result = await emailService.SendAsync(email, body);
        if (result.IsSuccess)
            emailRateLimitService.RegisterEmailSent(EmailType.PasswordReset, email, ipAddress);
    
        return Result.Success();
    }
    
    
    /// <inheritdoc/>
    public async Task<Result> ResetPasswordAsync(string email, string code, string newPassword, string ipAddress)
    {
        logger.LogInformation("ResetPasswordAsync. Payload: {@Payload}", new { email });
    
        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
            return Result.Failure("Invalid reset attempt");
    
        // ====== Valider koden ======
        var validateResult = await verificationService.ValidatePasswordResetCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt, $"Password reset locked out for {email}");

            return Result.Failure(validateResult.Error);
        }
        
        // ====== Reset passord via Identity ======
        // Fjern først
        var removeResult = await userManager.RemovePasswordAsync(user);
        if (!removeResult.Succeeded)
        {
            logger.LogError("Failed to remove password for {Email}", email);
            return Result.Failure("Failed to reset password");
        }
        
        // Så legg til nytt Passord
        var addResult = await userManager.AddPasswordAsync(user, newPassword);
        if (!addResult.Succeeded)
        {
            var errors = string.Join(" ", addResult.Errors.Select(e => e.Description));
            logger.LogWarning("Failed to set new password for {Email}: {Errors}", email, errors);
            return Result.Failure(errors);
        }
    
        // Nullstill rate limit cooldown for password reset
        emailRateLimitService.ClearEmailAttempts(EmailType.PasswordReset, email);
    
        logger.LogInformation("Password reset successful for {Email}", email);
        return Result.Success();
    }
    
    
    // ======================== Sms verifisiering ======================== 
    
    public async Task<Result> ResendPhoneVerificationAsync(string phoneNumber, string ipAddress)
    {
        logger.LogInformation("ResendPhoneVerificationAsync. Payload: {@Payload}", new { phoneNumber });

        // ====== Rate limit ======
        var rateLimitResult = smsRateLimitService.CanSendSms(SmsType.Verification, phoneNumber, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.SmsRateLimitExceeded, 
                $"Resend phone verification rate limit exceeded for {phoneNumber}");

            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }

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
        var code = await verificationService.GeneratePhoneVerificationAsync(user.Id);

        var message = $"Your Koptr verification code is: {code}";
        var result = await smsService.SendAsync(phoneNumber, message);

        if (result.IsSuccess)
            smsRateLimitService.RegisterSmsSent(SmsType.Verification, phoneNumber, ipAddress);

        return Result.Success();
    }

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
        var validateResult = await verificationService.ValidatePhoneCodeAsync(user.Id, code);
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

