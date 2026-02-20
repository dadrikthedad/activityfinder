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

namespace AFBack.Features.Auth.Services;

public class AuthService(
   UserManager<AppUser> userManager,
   ILogger<AuthService> logger,
   IUserRepository userRepository,
   IConfiguration configuration,
   IEmailService emailService,
   IVerificationService verificationService,
   IEmailRateLimitService emailRateLimitService,
   ISmsRateLimitService smsRateLimitService,
   IUserDeviceService userDeviceService,   
   ILoginHistoryService loginHistoryService,
   ISmsService smsService,
   ISuspiciousActivityService suspiciousActivityService,
   IVerificationRepository verificationRepository,
   ITokenService tokenService) : IAuthService
{
    // Hasher et passord ved oppstart så endringer som skjer i PasswordHashService gir alltid et korrekt
    // Dummy passord.
    private static readonly string DummyPasswordHash;
    
    static AuthService()
    {   
        // Hasher DummyPassord ved oppstart
        var hasher = new PasswordHashService();
        DummyPasswordHash = hasher.HashPassword("DummyP@ssw0rd!That$N0body&Will#Ever*Guess");
    }
    
    // ======================== SignUp ======================== 
    
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
        var emailDto = new EmailCodeDto(
            Email: request.Email,
            Code: code,
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
  
    // ======================== Login ======================== 
   
   /// <inheritdoc/>
   public async Task<Result<LoginResponse>> LoginAsync(LoginRequest request, string ipAddress, string? userAgent)
   {
       logger.LogInformation("LoginAsync. Payload: {@Payload}", new { request.Email });

       // ====== Finn bruker (eller bruk DummyUser for timing-beskyttelse) ======
       var user = await userManager.FindByEmailAsync(request.Email);
        
       // Returner ikke med engang for å simulere en ekte bruker
       if (user == null)
           logger.LogWarning("Login failed. User not found for {Email}", request.Email);

       // ====== Lockout-sjekk med Identity ======
       if (user != null && await userManager.IsLockedOutAsync(user))
       {
           var lockoutEnd = await userManager.GetLockoutEndDateAsync(user);
           logger.LogWarning("Login failed. Account locked for {Email} until {LockoutEnd}",
               request.Email, lockoutEnd);
           return Result<LoginResponse>.Failure(
               "Your account has been locked due to security reasons. " +
               "Please try again later or reset your password.");
       }

       // ====== Passord-validering ======
       // Bruker enten user eller dummy user for å simulere en passord-sjekk
       var targetUser = user ?? DummyUser;
       var isPasswordValid = await userManager.CheckPasswordAsync(targetUser, request.Password);
        
       // Bruker er null eller passord er feil, returner samme feilmelding
       if (user == null || !isPasswordValid)
       {   
           // Registerer at brukeren har tatt feil passord
           if (user != null)
           {
               await userManager.AccessFailedAsync(user);
                
               // Sjekk om brukeren nettopp ble låst ute
               if (await userManager.IsLockedOutAsync(user))
               {
                   await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                       SuspiciousActivityType.BruteForceAttempt,
                       $"Account locked after max failed login attempts for {request.Email}",
                       userId: user.Id);
               }
           }

           logger.LogWarning("Login failed. Invalid credentials for {Email}", request.Email);
           return Result<LoginResponse>.Failure("Wrong email or password");
       }
       
       // ====== Epost-verifisering ======
       if (!user.EmailConfirmed)
       {
           logger.LogWarning("Login failed. Email not confirmed for {Email}", request.Email);
           var resendResult = await ResendVerificationEmailAsync(request.Email, ipAddress);
            
           // Forskjellige melding utifra om brukeren har fått en feil (nådd ratelimit, eller noe annet feielt)
           var message = resendResult.IsSuccess
               ? "Your email is not yet verified. We've sent a new verification email."
               : "Your email is not yet verified. Please try again later.";
    
           return Result<LoginResponse>.Failure(message, ErrorTypeEnum.Unauthorized);
       }

       // ====== Telefon-verifisering ======
       if (!user.PhoneNumberConfirmed)
       {
           logger.LogWarning("Login failed. Phone not confirmed for {Email}", request.Email);
           var resendResult = await ResendPhoneVerificationAsync(user.PhoneNumber!, ipAddress);
            
           // Forskjellige melding utifra om brukeren har fått en feil (nådd ratelimit, eller noe annet feielt)
           var message = resendResult.IsSuccess
               ? "Your phone number is not yet verified. We've sent a new verification SMS."
               : "Your phone number is not yet verified. Please try again later.";
    
           return Result<LoginResponse>.Failure(message, ErrorTypeEnum.Unauthorized);
       }

       // ====== Nullstill failed attempts med Identity ======
       await userManager.ResetAccessFailedCountAsync(user);
        
       // ====== Device tracking ======
       // Oppretter eller oppdaterer UserDevice for brukeren
       var device = await userDeviceService.ResolveOrCreateDeviceAsync(user.Id, request.Device, ipAddress);

       // ====== Generer tokens ======
       var roles = await userManager.GetRolesAsync(user);
       var loginResponse = await tokenService.GenerateTokenPairAsync(
           user, device, roles, ipAddress, userAgent);
        
       // Oppretter innloggingshistorikk
       await loginHistoryService.RecordLoginAsync(user.Id, device.Id, ipAddress, userAgent);

       logger.LogInformation("Login successful for {Email} on device {DeviceName}",
           request.Email, device.DeviceName);

       return Result<LoginResponse>.Success(loginResponse);
   }
    
   /// <summary>
   /// En Dummy User for å simulere en ikke-eksisterende bruker
   /// </summary>
   private static readonly AppUser DummyUser = new ()
   {
       Id = "00000000-0000-0000-0000-000000000000",
       UserName = "dummy@example.com",
       NormalizedUserName = "DUMMY@EXAMPLE.COM",
       Email = "dummy@example.com",
       NormalizedEmail = "DUMMY@EXAMPLE.COM", 
       PasswordHash = DummyPasswordHash
   };
    
   
   // ======================== Logout ======================== 
   
   
   /// <inheritdoc/>
   public async Task<Result> LogoutAsync(string userId, string refreshToken, string accessTokenJti, 
       DateTime accessTokenExpiry, int deviceId)
   {
       logger.LogInformation("LogoutAsync. UserId: {UserId}", userId);
        
       // Revoker token
       await tokenService.RevokeTokenAsync(userId, refreshToken, 
           accessTokenJti, accessTokenExpiry, "User logout");
       
       // Logger utloggingen
       await loginHistoryService.RecordLogoutAsync(userId, deviceId);
       
       logger.LogInformation("Logout completed for UserId: {UserId}", userId);
       return Result.Success();
   }
   
   /// <inheritdoc/>
   public async Task<Result> LogoutAllDevicesAsync(string userId, string accessTokenJti, 
       DateTime accessTokenExpiry)
   {
       logger.LogInformation("LogoutAllDevicesAsync. UserId: {UserId}", userId);
    
       // Blacklist nåværende access token
       await tokenService.BlacklistAccessTokenAsync(accessTokenJti, accessTokenExpiry);
    
       // Revoker alle refresh tokens
       await tokenService.RevokeAllTokensForUserAsync(userId, "User logged out from all devices");
       
       // Registerer logout på alle enheter for brukeren
       await loginHistoryService.RecordLogoutAllAsync(userId);
       
       logger.LogInformation("All sessions terminated for UserId: {UserId}", userId);
       return Result.Success();
   }
    
   // ======================== Email verifisiering ======================== 
   
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

    // ======================== Glemt passord ======================== 
    
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
        var emailCode = await verificationService.GenerateEmailPasswordResetAsync(user.Id);
    
        var emailData = new EmailCodeDto(
            Email: email,
            Code: emailCode,
            BaseUrl: configuration["App:BaseUrl"]!);
    
        var body = EmailTemplates.PasswordReset(emailData);
    
        var result = await emailService.SendAsync(email, body);
        if (result.IsSuccess)
            emailRateLimitService.RegisterEmailSent(EmailType.PasswordReset, email, ipAddress);
    
        return Result.Success();
    }
    
    // ======================== Glemt passord — Steg 2: Verifiser epost-kode ========================
    
    /// <inheritdoc/>
    public async Task<Result> VerifyPasswordResetEmailCodeAsync(string email, string code, string ipAddress)
    {
        logger.LogInformation("VerifyPasswordResetEmailCodeAsync. Payload: {@Payload}", new { email });
        
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            logger.LogWarning("IpAddress: {IpAddress} is trying to verify password reset code for " +
                              "non-existent user. Email: {Email}", ipAddress, email);
            return Result.Failure("Invalid reset attempt");
        }
        
        var validateResult = await verificationService.ValidateEmailPasswordResetCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"Password reset email code locked out for {email}");
            
            return validateResult;
        }
        
        logger.LogInformation(
            "Password reset email code verified for {Email}. User can now request SMS code.", email);
        return Result.Success();
    }
    
    // ======================== Glemt passord — Steg 3: Send SMS ========================
    
    /// <inheritdoc/>
    public async Task<Result> SendPasswordResetSmsAsync(string email, string ipAddress)
    {
        logger.LogInformation("SendPasswordResetSmsAsync. Payload: {@Payload}", new { email });
        
        // Finn bruker
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            logger.LogWarning("IpAddress: {IpAddress} is trying to send password reset code for " +
                              "non-existent user. Email: {Email}", ipAddress, email);
            return Result.Failure("Invalid reset attempt");
        }
        
        // Rate limit SMS
        var rateLimitResult = smsRateLimitService.CanSendSms(SmsType.PasswordReset, user.PhoneNumber!, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.SmsRateLimitExceeded,
                $"Password reset SMS rate limit exceeded for {user.PhoneNumber!}");
            
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
        
        // Generer SMS-kode (guard i VerificationService sjekker PasswordResetEmailVerified)
        var smsCode = await verificationService.GenerateSmsPasswordResetCodeAsync(user.Id);
        
        var message = $"Your Koptr password reset code is: {smsCode}";
        var result = await smsService.SendAsync(user.PhoneNumber!, message);
        
        if (result.IsSuccess)
            smsRateLimitService.RegisterSmsSent(SmsType.PasswordReset, user.PhoneNumber!, ipAddress);
        
        return Result.Success();
    }
    
    
    /// <inheritdoc/>
    public async Task<Result> ResetPasswordAsync(string email, string code, string newPassword, string ipAddress)
    {
        logger.LogInformation("ResetPasswordAsync. Payload: {@Payload}", new { email });
    
        // ====== Finn bruker ======
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            logger.LogWarning("IpAddress: {IpAddress} is trying to verify sms password reset code for " +
                              "non-existent user. Email: {Email}", ipAddress, email);
            return Result.Failure("Invalid reset attempt");
        }
    
        // ====== Valider koden ======
        var validateResult = await verificationService.ValidateSmsPasswordResetCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt, 
                    $"Password reset SMS code locked out for {email}");

            return validateResult;
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
    
    // ======================== Innloggede servicer ======================== 
    
    
    // ======================== Bytt passord (innlogget) ======================== 

    /// <inheritdoc/>
    public async Task<Result> ChangePasswordAsync(string userId, string currentPassword, string newPassword)
    {
        logger.LogInformation("ChangePasswordAsync. UserId: {UserId}", userId);
    
        // Finn bruker
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Change password requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
    
        // Valider gammelt passord
        var isCurrentPasswordValid = await userManager.CheckPasswordAsync(user, currentPassword);
        if (!isCurrentPasswordValid)
        {
            logger.LogWarning("Change password failed — wrong current password for UserId: {UserId}", userId);
            return Result.Failure("Current password is incorrect");
        }
    
        // Bytt passord via Identity
        var changeResult = await userManager.ChangePasswordAsync(user, currentPassword, newPassword);
        if (!changeResult.Succeeded)
        {
            var errors = string.Join(" ", changeResult.Errors.Select(e => e.Description));
            logger.LogWarning("Failed to change password for UserId: {UserId}. Errors: {Errors}", 
                userId, errors);
            return Result.Failure(errors);
        }
    
        logger.LogInformation("Password changed successfully for UserId: {UserId}", userId);
        return Result.Success();
    }
    
    // ======================== Bytte e-post (innlogget) ======================== 

    /// <inheritdoc/>
    public async Task<Result> RequestEmailChangeAsync(string userId, string currentPassword, 
        string newEmail, string ipAddress)
    {
        logger.LogInformation("RequestEmailChangeAsync. UserId: {UserId}", userId);
        
        // ====== Rate limit ======
        var rateLimitResult = emailRateLimitService.CanSendEmail(EmailType.EmailChange, newEmail, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.EmailRateLimitExceeded,
                $"Email change rate limit exceeded for UserId: {userId}");
            
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Change email requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Valider passord ======
        var isPasswordValid = await userManager.CheckPasswordAsync(user, currentPassword);
        if (!isPasswordValid)
        {
            logger.LogWarning("Email change failed — wrong password for UserId: {UserId}", userId);
            return Result.Failure("Current password is incorrect");
        }
        
        // ====== Sjekk at ny epost ikke er i bruk ======
        var existingUser = await userManager.FindByEmailAsync(newEmail);
        if (existingUser != null)
        {
            logger.LogWarning("Email change failed — email already in use: {NewEmail}", newEmail);
            return Result.Failure("This email is already in use", ErrorTypeEnum.Conflict);
        }
        
        // ====== Sjekk at ny epost ikke er lik nåværende ======
        if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            return Result.Failure("New email must be different from current email");
        
        // ====== Generer kode og send til NÅVÆRENDE epost ======
        var code = await verificationService.GenerateOldEmailChangeCodeAsync(user.Id, newEmail);
        
        // Generer security alert token for "This wasn't me"-knappen
        var alertToken = await verificationService.GenerateSecurityAlertTokenAsync(user.Id);
        var alertUrl = $"{configuration["App:BaseUrl"]}/security-alert?token={alertToken}";
        
        var emailDto = new EmailChangeVerificationDto(
            Email: user.Email!,
            NewEmail: newEmail,
            VerificationCode: code,
            BaseUrl: configuration["App:BaseUrl"]!,
            AlertUrl: alertUrl);
        
        var body = EmailTemplates.EmailChangeVerification(emailDto);
        
        var result = await emailService.SendAsync(user.Email!, body);
        if (result.IsSuccess)
            emailRateLimitService.RegisterEmailSent(EmailType.EmailChange, user.Email!, ipAddress);
        
        logger.LogInformation(
            "Email change verification sent to current email {Email} for UserId: {UserId}", 
            user.Email, userId);
        return Result.Success();
    }
    
    /// <inheritdoc/>
    public async Task<Result> VerifyCurrentEmailForChangeAsync(string userId, string code, string ipAddress)
    {
        logger.LogInformation("VerifyCurrentEmailForChangeAsync. UserId: {UserId}", userId);
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Verify current email for change requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Valider kode — returnerer ny epost ved suksess ======
        var validateResult = await verificationService.ValidateOldEmailChangeCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"Old email change code locked out for UserId: {userId}");
            
            return Result.Failure(validateResult.Error, validateResult.ErrorType);
        }
        
        var newEmail = validateResult.Value!;
        
        // ====== Rate limit for ny epost ======
        var rateLimitResult = emailRateLimitService.CanSendEmail(EmailType.EmailChange, newEmail, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.EmailRateLimitExceeded,
                $"Email change rate limit exceeded for new email: {newEmail}");
            
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
        
        // ====== Send verifiseringskode til NY epost ======
        var newCode = await verificationService.GenerateNewEmailChangeCodeAsync(user.Id, newEmail);
        
        var emailDto = new EmailCodeDto(
            Email: newEmail,
            Code: newCode,
            BaseUrl: configuration["App:BaseUrl"]!);
        
        var body = EmailTemplates.EmailChange(emailDto);
        
        var result = await emailService.SendAsync(newEmail, body);
        if (result.IsSuccess)
            emailRateLimitService.RegisterEmailSent(EmailType.EmailChange, newEmail, ipAddress);
        
        logger.LogInformation(
            "New email verification sent to {NewEmail} for UserId: {UserId}", newEmail, userId);
        return Result.Success();
    }

    /// <inheritdoc/>
    public async Task<Result> VerifyEmailChangeAsync(string userId, string code, string ipAddress)
    {
        logger.LogInformation("VerifyEmailChangeAsync. UserId: {UserId}", userId);
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Verify change email requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Valider kode — returnerer den nye eposten ved suksess ======
        var validateResult = await verificationService.ValidateNewEmailChangeCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"New email change code locked out for UserId: {userId}");
            
            return Result.Failure(validateResult.Error, validateResult.ErrorType);
        }
        
        var newEmail = validateResult.Value!;
        
        // ====== Dobbeltsjekk at eposten fortsatt er ledig ======
        var existingUser = await userManager.FindByEmailAsync(newEmail);
        if (existingUser != null)
        {
            logger.LogWarning(
                "Email change verification succeeded but email was taken in the meantime: {NewEmail}",
                newEmail);
            return Result.Failure("This email is no longer available", ErrorTypeEnum.Conflict);
        }
        
        // ====== Lagre gammel epost for evt. recovery ======
        var oldEmail = user.Email;
        var verificationInfo = await verificationRepository.GetByUserIdAsync(user.Id);
        if (verificationInfo != null)
            verificationInfo.PreviousEmail = oldEmail;
        
        // ====== Oppdater epost ======
        user.Email = newEmail;
        user.NormalizedEmail = newEmail.ToUpperInvariant();
        user.UserName = newEmail;
        user.NormalizedUserName = newEmail.ToUpperInvariant();
        
        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            logger.LogError("Failed to update email for UserId: {UserId}. Errors: {Errors}", userId, errors);
            return Result.Failure("Failed to update email");
        }
        
        // Nullstill rate limit
        emailRateLimitService.ClearEmailAttempts(EmailType.EmailChange, newEmail);
        
        logger.LogInformation("Email changed from {OldEmail} to {NewEmail} for UserId: {UserId}", 
            oldEmail, newEmail, userId);
        return Result.Success();
    }

    // ======================== Bytte telefonnummer (innlogget) ======================== 

    /// <inheritdoc/>
    public async Task<Result> RequestPhoneChangeAsync(string userId, string currentPassword, 
        string newPhoneNumber, string ipAddress)
    {
        logger.LogInformation("RequestPhoneChangeAsync. UserId: {UserId}", userId);
        
        // ====== Rate limit (epost, ikke SMS — steg 1 sendes via epost) ======
        var rateLimitResult = emailRateLimitService.CanSendEmail(EmailType.PhoneChange, 
            newPhoneNumber, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.EmailRateLimitExceeded,
                $"Phone change rate limit exceeded for UserId: {userId}");
            
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Change phone requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Valider passord ======
        var isPasswordValid = await userManager.CheckPasswordAsync(user, currentPassword);
        if (!isPasswordValid)
        {
            logger.LogWarning("Phone change failed — wrong password for UserId: {UserId}", userId);
            return Result.Failure("Current password is incorrect");
        }
        
        // ====== Sjekk at nytt nummer ikke er i bruk ======
        var existingUser = await userRepository.FindByPhoneAsync(newPhoneNumber);
        if (existingUser != null)
        {
            logger.LogWarning("Phone change failed — phone already in use: {NewPhone}", newPhoneNumber);
            return Result.Failure("This phone number is already in use", ErrorTypeEnum.Conflict);
        }
        
        // ====== Sjekk at nytt nummer ikke er lik nåværende ======
        if (string.Equals(user.PhoneNumber, newPhoneNumber, StringComparison.OrdinalIgnoreCase))
            return Result.Failure("New phone number must be different from current phone number");
        
        // ====== Generer kode og send til NÅVÆRENDE epost ======
        var code = await verificationService.GeneratePhoneChangeEmailCodeAsync(user.Id, newPhoneNumber);
        
        // Generer security alert token for "This wasn't me"-knappen
        var alertToken = await verificationService.GenerateSecurityAlertTokenAsync(user.Id);
        var alertUrl = $"{configuration["App:BaseUrl"]}/security-alert?token={alertToken}";
        
        var emailDto = new PhoneChangeVerificationDto(
            Email: user.Email!,
            NewPhoneNumber: newPhoneNumber,
            VerificationCode: code,
            BaseUrl: configuration["App:BaseUrl"]!,
            AlertUrl: alertUrl);
        
        var body = EmailTemplates.PhoneChangeVerification(emailDto);
        
        var result = await emailService.SendAsync(user.Email!, body);
        if (result.IsSuccess)
            emailRateLimitService.RegisterEmailSent(EmailType.PhoneChange, user.Email!, ipAddress);
        
        logger.LogInformation(
            "Phone change verification sent to email {Email} for UserId: {UserId}", 
            user.Email, userId);
        return Result.Success();
    }
    
    /// <inheritdoc/>
    public async Task<Result> VerifyCurrentEmailForPhoneChangeAsync(string userId, string code, string ipAddress)
    {
        logger.LogInformation("VerifyCurrentEmailForPhoneChangeAsync. UserId: {UserId}", userId);
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning(
                "Verify email for phone change requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Valider kode — returnerer nytt telefonnummer ved suksess ======
        var validateResult = await verificationService.ValidatePhoneChangeEmailCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"Phone change email code locked out for UserId: {userId}");
            
            return Result.Failure(validateResult.Error, validateResult.ErrorType);
        }
        
        var newPhoneNumber = validateResult.Value!;
        
        // ====== Rate limit for SMS ======
        var rateLimitResult = smsRateLimitService.CanSendSms(SmsType.PhoneChange, newPhoneNumber, ipAddress);
        if (rateLimitResult.IsFailure)
        {
            await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                SuspiciousActivityType.SmsRateLimitExceeded,
                $"Phone change SMS rate limit exceeded for: {newPhoneNumber}");
            
            return Result.Failure(rateLimitResult.Error, ErrorTypeEnum.TooManyRequests);
        }
        
        // ====== Send SMS-kode til NYTT nummer ======
        var smsCode = await verificationService.GenerateNewPhoneChangeCodeAsync(user.Id, newPhoneNumber);
        
        var message = $"Your Koptr verification code is: {smsCode}";
        var result = await smsService.SendAsync(newPhoneNumber, message);
        
        if (result.IsSuccess)
            smsRateLimitService.RegisterSmsSent(SmsType.PhoneChange, newPhoneNumber, ipAddress);
        
        logger.LogInformation(
            "Phone change SMS sent to {NewPhone} for UserId: {UserId}", newPhoneNumber, userId);
        return Result.Success();
    }

    /// <inheritdoc/>
    public async Task<Result> VerifyPhoneChangeAsync(string userId, string code, string ipAddress)
    {
        logger.LogInformation("VerifyPhoneChangeAsync. UserId: {UserId}", userId);
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Verify change phone requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Valider kode — returnerer det nye nummeret ved suksess ======
        var validateResult = await verificationService.ValidateNewPhoneChangeCodeAsync(user.Id, code);
        if (validateResult.IsFailure)
        {
            if (validateResult.ErrorType == ErrorTypeEnum.TooManyRequests)
                await suspiciousActivityService.ReportSuspiciousActivityAsync(ipAddress,
                    SuspiciousActivityType.BruteForceAttempt,
                    $"New phone change code locked out for UserId: {userId}");
            
            return Result.Failure(validateResult.Error, validateResult.ErrorType);
        }
        
        var newPhone = validateResult.Value!;
        
        // ====== Dobbeltsjekk at nummeret fortsatt er ledig ======
        var existingUser = await userRepository.FindByPhoneAsync(newPhone);
        if (existingUser != null)
        {
            logger.LogWarning(
                "Phone change verification succeeded but phone was taken in the meantime: {NewPhone}",
                newPhone);
            return Result.Failure("This phone number is no longer available", ErrorTypeEnum.Conflict);
        }
        
        // ====== Lagre gammelt nummer for evt. recovery ======
        var oldPhone = user.PhoneNumber;
        var verificationInfo = await verificationRepository.GetByUserIdAsync(user.Id);
        if (verificationInfo != null)
            verificationInfo.PreviousPhoneNumber = oldPhone;
        
        // ====== Oppdater telefonnummer ======
        user.PhoneNumber = newPhone;
        user.PhoneNumberConfirmed = true; // Nytt nummer er allerede verifisert via koden
        
        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            logger.LogError("Failed to update phone for UserId: {UserId}. Errors: {Errors}", userId, errors);
            return Result.Failure("Failed to update phone number");
        }
        
        // Nullstill rate limit
        smsRateLimitService.ClearSmsAttempts(SmsType.PhoneChange, newPhone);
        
        logger.LogInformation("Phone changed from {OldPhone} to {NewPhone} for UserId: {UserId}", 
            oldPhone, newPhone, userId);
        return Result.Success();
    }
    
    
    // ======================== Sikkerhetsvarsling ========================

    /// <inheritdoc/>
    public async Task<Result> ReportUnauthorizedChangeAsync(string token, string ipAddress)
    {
        logger.LogWarning("ReportUnauthorizedChangeAsync triggered from IP: {IpAddress}", ipAddress);
        
        // ====== Valider token og nullstill alle pending-endringer ======
        var validateResult = await verificationService.ValidateSecurityAlertTokenAsync(token);
        if (validateResult.IsFailure)
            return Result.Failure(validateResult.Error);
        
        var userId = validateResult.Value!;
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogError("Security alert: User not found after token validation. UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Revoker alle tokens — tving utlogging fra alle enheter. Og logger utlogging ======
        await tokenService.RevokeAllTokensForUserAsync(userId, "Unauthorized change reported — account locked");
        await loginHistoryService.RecordLogoutAllAsync(userId);
        
        // ====== Sjekk om eposten ble byttet — rull tilbake ======
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId);
        var targetEmail = user.Email!;
    
        if (verificationInfo?.PreviousEmail != null)
        {
            var previousEmail = verificationInfo.PreviousEmail;
        
            user.Email = previousEmail;
            user.NormalizedEmail = previousEmail.ToUpperInvariant();
            user.UserName = previousEmail;
            user.NormalizedUserName = previousEmail.ToUpperInvariant();
        
            await userManager.UpdateAsync(user);
        
            verificationInfo.PreviousEmail = null;
            targetEmail = previousEmail;
        
            logger.LogWarning(
                "Email reverted to {PreviousEmail} for UserId: {UserId} after unauthorized change report",
                previousEmail, userId);
        }
        
        // ====== Sjekk om telefon ble byttet — rull tilbake ======
        if (verificationInfo?.PreviousPhoneNumber != null)
        {
            var previousPhone = verificationInfo.PreviousPhoneNumber;
    
            user.PhoneNumber = previousPhone;
            user.PhoneNumberConfirmed = true;
    
            await userManager.UpdateAsync(user);
    
            verificationInfo.PreviousPhoneNumber = null;
    
            logger.LogWarning(
                "Phone reverted to {PreviousPhone} for UserId: {UserId} after unauthorized change report",
                previousPhone, userId);
        }
        
        // ====== Lås kontoen via Identity (24 timer) ======
        await userManager.SetLockoutEnabledAsync(user, true);
        await userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddHours(24));
        
        // ====== Rapporter mistenkelig aktivitet ======
        await suspiciousActivityService.ReportSuspiciousActivityAsync(
            ipAddress,
            SuspiciousActivityType.UnauthorizedChangeReported,
            $"User {targetEmail} reported unauthorized change. Account locked.",
            userId: userId);
        
        // ====== Send account-locked epost med reset-kode ======
        var resetCode = await verificationService.GenerateEmailPasswordResetAsync(userId);
        
        var emailData = new EmailCodeDto(
            Email: user.Email!,
            Code: resetCode,
            BaseUrl: configuration["App:BaseUrl"]!);
        
        var body = EmailTemplates.AccountLocked(emailData);
        await emailService.SendAsync(targetEmail, body);
        
        logger.LogWarning(
            "Account locked and password reset sent to {Email} for UserId: {UserId} after unauthorized change report",
            targetEmail, userId);
        
        return Result.Success();
    }


    // ======================== NY HJELPEMETODE: SendSecurityAlertEmailAsync ========================

    /// <summary>
    /// Genererer security alert token og sender varslings-epost til brukerens nåværende epost.
    /// Brukes av RequestPhoneChangeAsync
    /// </summary>
    /// <param name="user">Brukeren som endringen gjelder</param>
    /// <param name="changeType">Hva som endres: "email address" eller "phone number"</param>
    private async Task SendSecurityAlertEmailAsync(AppUser user, string changeType)
    {
        var alertToken = await verificationService.GenerateSecurityAlertTokenAsync(user.Id);
        
        var alertUrl = $"{configuration["App:BaseUrl"]}/security-alert?token={alertToken}";
        
        var alertDto = new SecurityAlertEmailDto(
            Email: user.Email!,
            ChangeType: changeType,
            SecurityAlertUrl: alertUrl,
            BaseUrl: configuration["App:BaseUrl"]!);
        
        var alertBody = EmailTemplates.SecurityAlert(alertDto);
        await emailService.SendAsync(user.Email!, alertBody);
        
        logger.LogInformation(
            "Security alert email sent to {Email} for {ChangeType} change on UserId: {UserId}",
            user.Email, changeType, user.Id);
    }
}

