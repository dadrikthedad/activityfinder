using System.Security.Cryptography;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.Repositories;

namespace AFBack.Features.Auth.Services;

public class VerificationService(
    IVerificationRepository verificationRepository,
    ILogger<VerificationService> logger) : IVerificationService
{
    // Henter settings fra Config-filen
    private static readonly TimeSpan EmailCodeExpiry = 
        TimeSpan.FromMinutes(VerificationConfig.EmailCodeExpiryMinutes);
    private static readonly TimeSpan PhoneCodeExpiry = 
        TimeSpan.FromMinutes(VerificationConfig.PhoneCodeExpiryMinutes); 
    private static readonly TimeSpan SecurityAlertTokenExpiry = 
        TimeSpan.FromHours(VerificationConfig.SecurityAlertTokenExpiryHours);
    
    // ======================== Epost verifisiering ========================
    
    /// <inheritdoc />
    public async Task<string> GenerateEmailVerificationAsync(string userId)
    {
        // Vi genererer 6-sifret kode for app og epost
        var code = GenerateSecureCode();

        // Hent eller opprett VerificationInfo
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
        
        
        // Oppdaterer VerificationInfo og nullstiller forsøksteller
        verificationInfo.EmailConfirmationCode = code;
        verificationInfo.EmailCodeExpiresAt = DateTime.UtcNow.Add(EmailCodeExpiry);
        verificationInfo.EmailCodeFailedAttempts = 0;
        verificationInfo.LastVerificationEmailSentAt = DateTime.UtcNow;
        
        // Lagerer i databasen
        await verificationRepository.SaveChangesAsync();

        logger.LogInformation("Email verification generated for UserId: {UserId}", userId);
        return code;
    }
    
    /// <inheritdoc />
    public async Task<Result> ValidateEmailCodeAsync(string userId, string code)
    {
        // Henter verificationInfo
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
        
        // For mange feilede forsøk — brukeren må be om ny kode
        if (verificationInfo.EmailCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "Email verification locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.EmailCodeFailedAttempts);
            return Result.Failure(
                "Too many failed attempts. Please request a new verification code.",
                ErrorTypeEnum.TooManyRequests);
        }
        
        // Utgått kode
        if (verificationInfo.EmailCodeExpiresAt < DateTime.UtcNow)
            return Result.Failure("Verification code has expired");
        
        // Feil kode — øk forsøksteller
        if (verificationInfo.EmailConfirmationCode != code)
        {
            verificationInfo.EmailCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
            
            var remaining = VerificationConfig.MaxFailedAttempts - verificationInfo.EmailCodeFailedAttempts;
            logger.LogWarning(
                "Invalid email verification code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result.Failure("Invalid verification code");
        }

        // Riktig kode — nullstill koden og forsøksteller
        verificationInfo.EmailConfirmationCode = null;
        verificationInfo.EmailCodeExpiresAt = null;
        verificationInfo.EmailCodeFailedAttempts = 0;
        
        // Lagrer i databasen
        await verificationRepository.SaveChangesAsync();

        return Result.Success();
    }
    
    
    // ======================== Telefon verifisiering ========================

    public async Task<string> GeneratePhoneVerificationAsync(string userId)
    {
        var code = GenerateSecureCode();

        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");

        verificationInfo.PhoneVerificationCode = code;
        verificationInfo.PhoneCodeExpiresAt = DateTime.UtcNow.Add(PhoneCodeExpiry);
        verificationInfo.PhoneCodeFailedAttempts = 0;
        verificationInfo.LastVerificationSmsSentAt = DateTime.UtcNow;

        await verificationRepository.SaveChangesAsync();

        logger.LogInformation("Phone verification generated for UserId: {UserId}", userId);
        return code;
    }

    public async Task<Result> ValidatePhoneCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");

        if (verificationInfo.PhoneCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "Phone verification locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.PhoneCodeFailedAttempts);
            return Result.Failure(
                "Too many failed attempts. Please request a new verification code.",
                ErrorTypeEnum.TooManyRequests);
        }

        if (verificationInfo.PhoneCodeExpiresAt < DateTime.UtcNow)
            return Result.Failure("Verification code has expired");

        if (verificationInfo.PhoneVerificationCode != code)
        {
            verificationInfo.PhoneCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();

            var remaining = VerificationConfig.MaxFailedAttempts - verificationInfo.PhoneCodeFailedAttempts;
            logger.LogWarning(
                "Invalid phone verification code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result.Failure("Invalid verification code");
        }

        verificationInfo.PhoneVerificationCode = null;
        verificationInfo.PhoneCodeExpiresAt = null;
        verificationInfo.PhoneCodeFailedAttempts = 0;

        await verificationRepository.SaveChangesAsync();

        return Result.Success();
    }
    
    // ======================== Passord reset — Epost (steg 1) ========================
    
    /// <inheritdoc />
    public async Task<string> GenerateEmailPasswordResetAsync(string userId)
    {
        // Generer 6-sifret kode for app og epost
        var code = GenerateSecureCode();

        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
        
        // Oppdaterer VerificationInfo
        verificationInfo.EmailPasswordResetCode = code;
        verificationInfo.EmailPasswordResetCodeExpiresAt = DateTime.UtcNow.Add(EmailCodeExpiry);
        verificationInfo.LastEmailPasswordResetSentAt = DateTime.UtcNow;
        // Resetter begge verifikasjons boolene for sikkerhetsskyld
        verificationInfo.EmailPasswordResetVerified = false;
        verificationInfo.SmsPasswordResetVerified = false;
        
        // Nullstill evt. gammel SMS-kode
        verificationInfo.SmsPasswordResetCode = null;
        verificationInfo.SmsPasswordResetCodeExpiresAt = null;
        verificationInfo.SmsPasswordResetCodeFailedAttempts = 0;
        
        // Lagerer i databasen
        await verificationRepository.SaveChangesAsync();

        logger.LogInformation("Password reset generated for UserId: {UserId}", userId);
        return code;
    }
    
     /// <inheritdoc />
     public async Task<Result> ValidateEmailPasswordResetCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
    
        // For mange feilede forsøk — brukeren må be om ny kode
        if (verificationInfo.EmailPasswordResetCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "Password reset locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.EmailPasswordResetCodeFailedAttempts);
            return Result.Failure("Too many failed attempts. Please request a new reset code.",
                ErrorTypeEnum.TooManyRequests);
        }
    
        // Utgått kode
        if (verificationInfo.EmailPasswordResetCodeExpiresAt < DateTime.UtcNow)
            return Result.Failure("Reset code has expired");
    
        // Feil kode — øk forsøksteller
        if (verificationInfo.EmailPasswordResetCode != code)
        {
            verificationInfo.EmailPasswordResetCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
        
            var remaining = VerificationConfig.MaxFailedAttempts - 
                            verificationInfo.EmailPasswordResetCodeFailedAttempts;
            logger.LogWarning(
                "Invalid password reset code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result.Failure("Invalid reset code");
        }

        // Riktig kode — nullstill koden og forsøksteller
        verificationInfo.EmailPasswordResetCode = null;
        verificationInfo.EmailPasswordResetCodeExpiresAt = null;
        verificationInfo.EmailPasswordResetCodeFailedAttempts = 0;
        verificationInfo.EmailPasswordResetVerified = true;
    
        await verificationRepository.SaveChangesAsync();
        
        logger.LogInformation("Password reset email code verified for UserId: {UserId}. SMS step unlocked.",
            userId);

        return Result.Success();
    }
    
    // ======================== Passord reset — SMS (steg 2) ========================

    public async Task<string> GenerateSmsPasswordResetCodeAsync(string userId)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
    
        // Guard: Email MÅ være verifisert først
        if (!verificationInfo.EmailPasswordResetVerified)
        {
            logger.LogWarning(
                "Attempted to generate SMS code without email verification for UserId: {UserId}", userId);
            throw new InvalidOperationException(
                "Email must be verified before SMS code can be generated");
        }
    
        var code = GenerateSecureCode();
    
        verificationInfo.SmsPasswordResetCode = code;
        verificationInfo.SmsPasswordResetCodeExpiresAt = DateTime.UtcNow.Add(PhoneCodeExpiry);
        verificationInfo.SmsPasswordResetCodeFailedAttempts = 0;
        verificationInfo.LastSmsPasswordResetSentAt = DateTime.UtcNow;
        
        await verificationRepository.SaveChangesAsync();
    
        logger.LogInformation(
            "SMS password reset code generated for UserId: {UserId}", userId);
    
        return code;
    }
    

   /// <inheritdoc />
   public async Task<Result> ValidateSmsPasswordResetCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
        
        // Guard: Epost MÅ være verifisert først
        if (!verificationInfo.EmailPasswordResetVerified)
        {
            logger.LogWarning(
                "Attempted to validate SMS password reset code without email verification for UserId: {UserId}", 
                userId);
            return Result.Failure(
                "Email verification must be completed first", ErrorTypeEnum.Unauthorized);
        }
        
        // For mange feilede forsøk — brukeren må be om ny kode
        if (verificationInfo.SmsPasswordResetCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "SMS password reset locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.SmsPasswordResetCodeFailedAttempts);
            return Result.Failure(
                "Too many failed attempts. Please request a new SMS code.", ErrorTypeEnum.TooManyRequests);
        }
        
        // Kode utgått
        if (verificationInfo.SmsPasswordResetCodeExpiresAt < DateTime.UtcNow)
            return Result.Failure("SMS reset code has expired");
        
        // Feil kode - øk teller 
        if (verificationInfo.SmsPasswordResetCode != code)
        {
            verificationInfo.SmsPasswordResetCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
            
            var remaining = VerificationConfig.MaxFailedAttempts - 
                            verificationInfo.SmsPasswordResetCodeFailedAttempts;
            logger.LogWarning(
                "Invalid SMS password reset code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result.Failure("Invalid SMS code");
        }
        
        // Steg 2 fullført — marker SMS som verifisert for password reset
        verificationInfo.SmsPasswordResetCode = null;
        verificationInfo.SmsPasswordResetCodeExpiresAt = null;
        verificationInfo.SmsPasswordResetCodeFailedAttempts = 0;
        verificationInfo.SmsPasswordResetVerified = true;
        
        await verificationRepository.SaveChangesAsync();
        
        logger.LogInformation(
            "SMS password reset code verified for UserId: {UserId}. Password reset unlocked.", userId);
        
        return Result.Success();
    }
   
    // ======================== Bytte e-post — Steg 1: Verifisering av nåværende epost ========================

    /// <inheritdoc />
    public async Task<string> GenerateOldEmailChangeCodeAsync(string userId, string newEmail)
    {
        var code = GenerateSecureCode();
    
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
    
        // Lagre ny epost som pending
        verificationInfo.PendingEmail = newEmail;
    
        // Generer kode for nåværende epost (steg 1)
        verificationInfo.OldEmailChangeCode = code;
        verificationInfo.OldEmailChangeCodeExpiresAt = DateTime.UtcNow.Add(EmailCodeExpiry);
        verificationInfo.OldEmailChangeCodeFailedAttempts = 0;
        verificationInfo.LastOldEmailChangeSentAt = DateTime.UtcNow;
    
        // Nullstill steg-flagg og steg 2-felter
        verificationInfo.CurrentEmailChangeVerified = false;
        verificationInfo.NewEmailChangeCode = null;
        verificationInfo.NewEmailChangeCodeExpiresAt = null;
        verificationInfo.NewEmailChangeCodeFailedAttempts = 0;
    
        await verificationRepository.SaveChangesAsync();
    
        logger.LogInformation("Old email change verification code generated for UserId: {UserId}", userId);
        return code;
    }

    

    /// <inheritdoc />
    public async Task<Result<string>> ValidateOldEmailChangeCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
        
        // Ingen pending epost
        if (string.IsNullOrEmpty(verificationInfo.PendingEmail))
            return Result<string>.Failure("No pending email change found");
        
        // For mange feilede forsøk
        if (verificationInfo.OldEmailChangeCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "Old email change code locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.OldEmailChangeCodeFailedAttempts);
            return Result<string>.Failure("Too many failed attempts. Please request a new verification code.",
                ErrorTypeEnum.TooManyRequests);
        }
        
        // Utgått kode
        if (verificationInfo.OldEmailChangeCodeExpiresAt < DateTime.UtcNow)
            return Result<string>.Failure("Verification code has expired");
        
        // Feil kode
        if (verificationInfo.OldEmailChangeCode != code)
        {
            verificationInfo.OldEmailChangeCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
            
            var remaining = VerificationConfig.MaxFailedAttempts - 
                            verificationInfo.OldEmailChangeCodeFailedAttempts;
            logger.LogWarning(
                "Invalid old email change code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result<string>.Failure("Invalid verification code");
        }
        
        // Riktig kode — marker steg 1 som fullført, nullstill steg 1-koden
        verificationInfo.OldEmailChangeCode = null;
        verificationInfo.OldEmailChangeCodeExpiresAt = null;
        verificationInfo.OldEmailChangeCodeFailedAttempts = 0;
        verificationInfo.CurrentEmailChangeVerified = true;
        
        await verificationRepository.SaveChangesAsync();
        
        var newEmail = verificationInfo.PendingEmail;
        
        logger.LogInformation(
            "Old email verified for email change. UserId: {UserId}. New email step unlocked.", userId);
        return Result<string>.Success(newEmail);
    }
    
    // ======================== Bytte e-post — Steg 2: Verifisering av ny epost ========================

    /// <inheritdoc />
    public async Task<string> GenerateNewEmailChangeCodeAsync(string userId, string newEmail)
    {
        var code = GenerateSecureCode();
    
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
    
        // Guard: Nåværende epost MÅ være verifisert først (steg 1)
        if (!verificationInfo.CurrentEmailChangeVerified)
        {
            logger.LogWarning(
                "Attempted to generate new email code without current email verification for UserId: {UserId}", 
                userId);
            throw new InvalidOperationException(
                "Current email must be verified before new email code can be generated");
        }
        
        // Oppdater feltene for ny kode
        verificationInfo.NewEmailChangeCode = code;
        verificationInfo.NewEmailChangeCodeExpiresAt = DateTime.UtcNow.Add(EmailCodeExpiry);
        verificationInfo.NewEmailChangeCodeFailedAttempts = 0;
        verificationInfo.LastNewEmailChangeSentAt = DateTime.UtcNow;
    
        await verificationRepository.SaveChangesAsync();
    
        logger.LogInformation("New email change code generated for UserId: {UserId}", userId);
        return code;
    }
    
    /// <inheritdoc />
    public async Task<Result<string>> ValidateNewEmailChangeCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
        
        // Ingen pending epost
        if (string.IsNullOrEmpty(verificationInfo.PendingEmail))
            return Result<string>.Failure("No pending email change found");
        
        // Guard: Steg 1 må være fullført
        if (!verificationInfo.CurrentEmailChangeVerified)
        {
            logger.LogWarning(
                "Attempted to validate new email code without current email verification for UserId: {UserId}", 
                userId);
            return Result<string>.Failure(
                "Current email verification must be completed first", ErrorTypeEnum.Unauthorized);
        }
        
        // For mange feilede forsøk
        if (verificationInfo.NewEmailChangeCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "New email change code locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.NewEmailChangeCodeFailedAttempts);
            return Result<string>.Failure(
                "Too many failed attempts. Please request a new verification code.",
                ErrorTypeEnum.TooManyRequests);
        }
        
        // Utgått kode
        if (verificationInfo.NewEmailChangeCodeExpiresAt < DateTime.UtcNow)
            return Result<string>.Failure("Verification code has expired");
        
        // Feil kode
        if (verificationInfo.NewEmailChangeCode != code)
        {
            verificationInfo.NewEmailChangeCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
            
            var remaining = VerificationConfig.MaxFailedAttempts - 
                            verificationInfo.NewEmailChangeCodeFailedAttempts;
            logger.LogWarning(
                "Invalid new email change code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result<string>.Failure("Invalid verification code");
        }
        
        // Riktig kode — hent ny epost og nullstill alle epost-bytte-felter
        var newEmail = verificationInfo.PendingEmail;
        
        verificationInfo.PendingEmail = null;
        verificationInfo.CurrentEmailChangeVerified = false;
        verificationInfo.OldEmailChangeCode = null;
        verificationInfo.OldEmailChangeCodeExpiresAt = null;
        verificationInfo.OldEmailChangeCodeFailedAttempts = 0;
        verificationInfo.NewEmailChangeCode = null;
        verificationInfo.NewEmailChangeCodeExpiresAt = null;
        verificationInfo.NewEmailChangeCodeFailedAttempts = 0;
        
        await verificationRepository.SaveChangesAsync();
        
        logger.LogInformation("New email code verified for UserId: {UserId}", userId);
        return Result<string>.Success(newEmail);
    }

    // ======================== Bytte telefonnummer (innlogget) ========================

    // ======================== Bytte telefonnummer — Steg 1: Verifisering via epost ========================

    /// <inheritdoc />
    public async Task<string> GeneratePhoneChangeEmailCodeAsync(string userId, string newPhoneNumber)
    {
        var code = GenerateSecureCode();
    
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
    
        // Lagre nytt nummer som pending
        verificationInfo.PendingPhoneNumber = newPhoneNumber;
    
        // Generer kode for epost-verifisering (steg 1)
        verificationInfo.PhoneChangeEmailCode = code;
        verificationInfo.PhoneChangeEmailCodeExpiresAt = DateTime.UtcNow.Add(EmailCodeExpiry);
        verificationInfo.PhoneChangeEmailCodeFailedAttempts = 0;
        verificationInfo.LastPhoneChangeEmailSentAt = DateTime.UtcNow;
    
        // Nullstill steg-flagg og steg 2-felter
        verificationInfo.CurrentPhoneChangeVerified = false;
        verificationInfo.NewPhoneChangeCode = null;
        verificationInfo.NewPhoneChangeCodeExpiresAt = null;
        verificationInfo.NewPhoneChangeCodeFailedAttempts = 0;
    
        await verificationRepository.SaveChangesAsync();
    
        logger.LogInformation(
            "Phone change email verification code generated for UserId: {UserId}", userId);
        return code;
    }

    /// <inheritdoc />
    public async Task<Result<string>> ValidatePhoneChangeEmailCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
        
        // Ingen pending telefonnummer
        if (string.IsNullOrEmpty(verificationInfo.PendingPhoneNumber))
            return Result<string>.Failure("No pending phone change found");
        
        // For mange feilede forsøk
        if (verificationInfo.PhoneChangeEmailCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "Phone change email code locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.PhoneChangeEmailCodeFailedAttempts);
            return Result<string>.Failure(
                "Too many failed attempts. Please request a new verification code.",
                ErrorTypeEnum.TooManyRequests);
        }
        
        // Utgått kode
        if (verificationInfo.PhoneChangeEmailCodeExpiresAt < DateTime.UtcNow)
            return Result<string>.Failure("Verification code has expired");
        
        // Feil kode
        if (verificationInfo.PhoneChangeEmailCode != code)
        {
            verificationInfo.PhoneChangeEmailCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
            
            var remaining = VerificationConfig.MaxFailedAttempts - 
                            verificationInfo.PhoneChangeEmailCodeFailedAttempts;
            logger.LogWarning(
                "Invalid phone change email code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result<string>.Failure("Invalid verification code");
        }
        
        // Riktig kode — marker steg 1 som fullført, nullstill steg 1-koden
        verificationInfo.PhoneChangeEmailCode = null;
        verificationInfo.PhoneChangeEmailCodeExpiresAt = null;
        verificationInfo.PhoneChangeEmailCodeFailedAttempts = 0;
        verificationInfo.CurrentPhoneChangeVerified = true;
        
        await verificationRepository.SaveChangesAsync();
        
        var newPhone = verificationInfo.PendingPhoneNumber;
        
        logger.LogInformation(
            "Email verified for phone change. UserId: {UserId}. SMS step unlocked.", userId);
        return Result<string>.Success(newPhone);
    }
    
    
    // ======================== Bytte telefonnummer — Steg 2: Verifisering av nytt nummer ========================

    /// <inheritdoc />
    public async Task<string> GenerateNewPhoneChangeCodeAsync(string userId, string newPhoneNumber)
    {
        var code = GenerateSecureCode();
    
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
    
        // Guard: Epost MÅ være verifisert først (steg 1)
        if (!verificationInfo.CurrentPhoneChangeVerified)
        {
            logger.LogWarning(
                "Attempted to generate new phone code without email verification for UserId: {UserId}", 
                userId);
            throw new InvalidOperationException(
                "Email must be verified before new phone code can be generated");
        }
    
        verificationInfo.NewPhoneChangeCode = code;
        verificationInfo.NewPhoneChangeCodeExpiresAt = DateTime.UtcNow.Add(PhoneCodeExpiry);
        verificationInfo.NewPhoneChangeCodeFailedAttempts = 0;
        verificationInfo.LastNewPhoneChangeSentAt = DateTime.UtcNow;
    
        await verificationRepository.SaveChangesAsync();
    
        logger.LogInformation("New phone change SMS code generated for UserId: {UserId}", userId);
        return code;
    }
    
    /// <inheritdoc />
    public async Task<Result<string>> ValidateNewPhoneChangeCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
        
        // Ingen pending telefonnummer
        if (string.IsNullOrEmpty(verificationInfo.PendingPhoneNumber))
            return Result<string>.Failure("No pending phone change found");
        
        // Guard: Steg 1 må være fullført
        if (!verificationInfo.CurrentPhoneChangeVerified)
        {
            logger.LogWarning(
                "Attempted to validate new phone code without email verification for UserId: {UserId}", 
                userId);
            return Result<string>.Failure(
                "Email verification must be completed first", ErrorTypeEnum.Unauthorized);
        }
        
        // For mange feilede forsøk
        if (verificationInfo.NewPhoneChangeCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "New phone change code locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.NewPhoneChangeCodeFailedAttempts);
            return Result<string>.Failure(
                "Too many failed attempts. Please request a new verification code.",
                ErrorTypeEnum.TooManyRequests);
        }
        
        // Utgått kode
        if (verificationInfo.NewPhoneChangeCodeExpiresAt < DateTime.UtcNow)
            return Result<string>.Failure("Verification code has expired");
        
        // Feil kode
        if (verificationInfo.NewPhoneChangeCode != code)
        {
            verificationInfo.NewPhoneChangeCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
            
            var remaining = VerificationConfig.MaxFailedAttempts - 
                            verificationInfo.NewPhoneChangeCodeFailedAttempts;
            logger.LogWarning(
                "Invalid new phone change code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result<string>.Failure("Invalid verification code");
        }
        
        // Riktig kode — hent nytt nummer og nullstill alle telefon-bytte-felter
        var newPhone = verificationInfo.PendingPhoneNumber;
        
        verificationInfo.PendingPhoneNumber = null;
        verificationInfo.CurrentPhoneChangeVerified = false;
        verificationInfo.PhoneChangeEmailCode = null;
        verificationInfo.PhoneChangeEmailCodeExpiresAt = null;
        verificationInfo.PhoneChangeEmailCodeFailedAttempts = 0;
        verificationInfo.NewPhoneChangeCode = null;
        verificationInfo.NewPhoneChangeCodeExpiresAt = null;
        verificationInfo.NewPhoneChangeCodeFailedAttempts = 0;
        
        await verificationRepository.SaveChangesAsync();
        
        logger.LogInformation("New phone code verified for UserId: {UserId}", userId);
        return Result<string>.Success(newPhone);
    }
    
    // ======================== Sikkerhetsvarsling ========================

    /// <inheritdoc />
    public async Task<string> GenerateSecurityAlertTokenAsync(string userId)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId)
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
        
        var token = Guid.NewGuid().ToString("N"); // 32 tegn, ingen bindestreker
        
        verificationInfo.SecurityAlertToken = token;
        verificationInfo.SecurityAlertTokenExpiresAt = DateTime.UtcNow.Add(SecurityAlertTokenExpiry);
        
        await verificationRepository.SaveChangesAsync();
        
        logger.LogInformation("Security alert token generated for UserId: {UserId}", userId);
        return token;
    }

    /// <inheritdoc />
    public async Task<Result<string>> ValidateSecurityAlertTokenAsync(string token)
    {
        var verificationInfo = await verificationRepository.GetBySecurityAlertTokenAsync(token);
        
        if (verificationInfo == null)
        {
            logger.LogWarning("Security alert token not found: {Token}", token);
            return Result<string>.Failure("Invalid or expired security token");
        }
        
        // Sjekk utløp
        if (verificationInfo.SecurityAlertTokenExpiresAt < DateTime.UtcNow)
        {
            // Nullstill utgått token
            verificationInfo.SecurityAlertToken = null;
            verificationInfo.SecurityAlertTokenExpiresAt = null;
            await verificationRepository.SaveChangesAsync();
            
            logger.LogWarning("Expired security alert token used for UserId: {UserId}", verificationInfo.UserId);
            return Result<string>.Failure("Security token has expired");
        }
        
        var userId = verificationInfo.UserId;
        
        // ====== Nullstill ALT — nødbremsen ======
        
        // Security alert token (engangsbruk)
        verificationInfo.SecurityAlertToken = null;
        verificationInfo.SecurityAlertTokenExpiresAt = null;
        
        // Pending epost-bytte — steg 1
        verificationInfo.PendingEmail = null;
        verificationInfo.CurrentEmailChangeVerified = false;
        verificationInfo.OldEmailChangeCode = null;
        verificationInfo.OldEmailChangeCodeExpiresAt = null;
        verificationInfo.OldEmailChangeCodeFailedAttempts = 0;

        // Pending epost-bytte — steg 2
        verificationInfo.NewEmailChangeCode = null;
        verificationInfo.NewEmailChangeCodeExpiresAt = null;
        verificationInfo.NewEmailChangeCodeFailedAttempts = 0;
        
        // Pending telefon-bytte — steg 1 (epost)
        verificationInfo.PendingPhoneNumber = null;
        verificationInfo.CurrentPhoneChangeVerified = false;
        verificationInfo.PhoneChangeEmailCode = null;
        verificationInfo.PhoneChangeEmailCodeExpiresAt = null;
        verificationInfo.PhoneChangeEmailCodeFailedAttempts = 0;

        // Pending telefon-bytte — steg 2 (SMS)
        verificationInfo.NewPhoneChangeCode = null;
        verificationInfo.NewPhoneChangeCodeExpiresAt = null;
        verificationInfo.NewPhoneChangeCodeFailedAttempts = 0;
        
        // Passord-reset (epost-steg)
        verificationInfo.EmailPasswordResetCode = null;
        verificationInfo.EmailPasswordResetCodeExpiresAt = null;
        verificationInfo.EmailPasswordResetCodeFailedAttempts = 0;
        verificationInfo.EmailPasswordResetVerified = false;
        
        // Passord-reset (SMS-steg)
        verificationInfo.SmsPasswordResetCode = null;
        verificationInfo.SmsPasswordResetCodeExpiresAt = null;
        verificationInfo.SmsPasswordResetCodeFailedAttempts = 0;
        verificationInfo.SmsPasswordResetVerified = false;
        
        await verificationRepository.SaveChangesAsync();
        
        logger.LogWarning(
            "Security alert token consumed for UserId: {UserId}. All pending changes cleared.", userId);
        
        return Result<string>.Success(userId);
    }
    
    // ======================== Hjelpemetoder ========================
   
    /// <summary>
    /// Genererer en kryptografisk sikker 6-sifret kode med RandomNumberGenerator
    /// </summary>
    private static string GenerateSecureCode() =>
        RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
}
