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
    private static readonly TimeSpan PasswordResetCodeExpiry = 
        TimeSpan.FromMinutes(VerificationConfig.PasswordResetCodeExpiryMinutes);
    private static readonly TimeSpan PhoneCodeExpiry = 
        TimeSpan.FromMinutes(VerificationConfig.PhoneCodeExpiryMinutes); 

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
    
    /// <inheritdoc />
    public async Task<string> GeneratePasswordResetAsync(string userId)
    {
        // Generer 6-sifret kode for app og epost
        var code = GenerateSecureCode();

        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
        
        // Oppdaterer VerificationInfo
        verificationInfo.PasswordResetCode = code;
        verificationInfo.PasswordResetCodeExpiresAt = DateTime.UtcNow.Add(PasswordResetCodeExpiry);
        verificationInfo.PasswordResetCodeFailedAttempts = 0;
        verificationInfo.LastPasswordResetEmailSentAt = DateTime.UtcNow;
        
        // Lagerer i databasen
        await verificationRepository.SaveChangesAsync();

        logger.LogInformation("Password reset generated for UserId: {UserId}", userId);
        return code;
    }

    /// <inheritdoc />
    public async Task<Result> ValidatePasswordResetCodeAsync(string userId, string code)
    {
        var verificationInfo = await verificationRepository.GetByUserIdAsync(userId) 
                               ?? throw new InvalidOperationException(
                                   $"VerificationInfo missing for UserId: " +
                                   $"{userId}. Was it created during signup?");
    
        // For mange feilede forsøk — brukeren må be om ny kode
        if (verificationInfo.PasswordResetCodeFailedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning(
                "Password reset locked out for UserId: {UserId} after {Attempts} failed attempts",
                userId, verificationInfo.PasswordResetCodeFailedAttempts);
            return Result.Failure("Too many failed attempts. Please request a new reset code.",
                ErrorTypeEnum.TooManyRequests);
        }
    
        // Utgått kode
        if (verificationInfo.PasswordResetCodeExpiresAt < DateTime.UtcNow)
            return Result.Failure("Reset code has expired");
    
        // Feil kode — øk forsøksteller
        if (verificationInfo.PasswordResetCode != code)
        {
            verificationInfo.PasswordResetCodeFailedAttempts++;
            await verificationRepository.SaveChangesAsync();
        
            var remaining = VerificationConfig.MaxFailedAttempts - verificationInfo.PasswordResetCodeFailedAttempts;
            logger.LogWarning(
                "Invalid password reset code for UserId: {UserId}. {Remaining} attempts remaining",
                userId, remaining);
            return Result.Failure("Invalid reset code");
        }

        // Riktig kode — nullstill koden og forsøksteller
        verificationInfo.PasswordResetCode = null;
        verificationInfo.PasswordResetCodeExpiresAt = null;
        verificationInfo.PasswordResetCodeFailedAttempts = 0;
    
        await verificationRepository.SaveChangesAsync();

        return Result.Success();
    }

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
    

    /// <summary>
    /// Genererer en kryptografisk sikker 6-sifret kode med RandomNumberGenerator
    /// </summary>
    private static string GenerateSecureCode() =>
        RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
}
