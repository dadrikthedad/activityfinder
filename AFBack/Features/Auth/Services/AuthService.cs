using AFBack.Common.Enum;
using AFBack.Common.Localization;
using AFBack.Common.Results;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Email.Templates;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Auth.Services;

public class AuthService(
   UserManager<AppUser> userManager,
   ILogger<AuthService> logger,
   IUserRepository userRepository,
   IConfiguration configuration,
   IEmailService emailService,
   IVerificationInfoService verificationInfoService,
   IEmailRateLimitService emailRateLimitService,
   IUserDeviceService userDeviceService,   
   ILoginHistoryService loginHistoryService,
   IAccountVerificationService accountVerificationService,
   ISuspiciousActivityService suspiciousActivityService,
   IVerificationInfoRepository verificationInfoRepository,
   ITokenService tokenService,
   IRateLimitGuardService rateLimitGuardService) : IAuthService
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
        var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.Verification, 
            request.Email, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result<SignupResponse>.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);
           
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
        var code = await verificationInfoService.GenerateEmailVerificationAsync(user.Id);
           
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
           var resendResult = await accountVerificationService.ResendVerificationEmailAsync(request.Email, ipAddress);
            
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
           var resendResult = await accountVerificationService.ResendPhoneVerificationAsync(user.PhoneNumber!, ipAddress);
            
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
   
   // ======================== Sikkerhetsvarsling ========================

    /// <inheritdoc/>
    public async Task<Result> ReportUnauthorizedChangeAsync(string token, string ipAddress)
    {
        logger.LogWarning("ReportUnauthorizedChangeAsync triggered from IP: {IpAddress}", ipAddress);
        
        // ====== Valider token og nullstill alle pending-endringer ======
        var validateResult = await verificationInfoService.ValidateSecurityAlertTokenAsync(token);
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
        var verificationInfo = await verificationInfoRepository.GetByUserIdAsync(userId);
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
        var resetCode = await verificationInfoService.GenerateEmailPasswordResetAsync(userId);
        
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
        var alertToken = await verificationInfoService.GenerateSecurityAlertTokenAsync(user.Id);
        
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

