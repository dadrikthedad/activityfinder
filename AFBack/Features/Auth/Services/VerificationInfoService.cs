using System.Security.Cryptography;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Configurations.Options;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services.Interfaces;

namespace AFBack.Features.Auth.Services;

public class VerificationInfoService(
    IVerificationInfoRepository verificationInfoRepository,
    ILogger<VerificationInfoService> logger) : IVerificationInfoService
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
    public async Task<string> GenerateEmailVerificationAsync(string userId, CancellationToken ct = default)
    {
        // Vi genererer 6-sifret kode for app og epost
        var code = GenerateSecureCode();
        // Hent eller opprett VerificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        
        // Oppdaterer VerificationInfo og nullstiller forsøksteller
        verificationInfo.EmailConfirmationCode = code;
        verificationInfo.EmailCodeExpiresAt = DateTime.UtcNow.Add(EmailCodeExpiry);
        verificationInfo.EmailCodeFailedAttempts = 0;
        verificationInfo.LastVerificationEmailSentAt = DateTime.UtcNow;
        
        // Lagerer i databasen
        await verificationInfoRepository.SaveChangesAsync(ct);

        logger.LogInformation("Email verification generated for UserId: {UserId}", userId);
        return code;
    }
    
    /// <inheritdoc />
    public async Task<Result> ValidateEmailCodeAsync(string userId, string code, CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        // Validerer antall brukte forsøk og øker antall forsøk hvis feil. Sjekker også om kode er korrekt eller 
        // om koden er utgått
        var result = await ValidateCodeAsync(userId,
            verificationInfo.EmailConfirmationCode, verificationInfo.EmailCodeExpiresAt,
            verificationInfo.EmailCodeFailedAttempts, code,
            () => verificationInfo.EmailCodeFailedAttempts++,
            "EmailVerification",
            ct);
    
        if (result.IsFailure)
            return result;

        // Riktig kode — nullstill koden og forsøksteller
        verificationInfo.EmailConfirmationCode = null;
        verificationInfo.EmailCodeExpiresAt = null;
        verificationInfo.EmailCodeFailedAttempts = 0;
        
        // Lagrer i databasen
        await verificationInfoRepository.SaveChangesAsync(ct);

        return Result.Success();
    }
    
    
    // ======================== Telefon verifisiering ========================

    public async Task<string> GeneratePhoneVerificationAsync(string userId, CancellationToken ct = default)
    {
        var code = GenerateSecureCode();

        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);

        verificationInfo.PhoneVerificationCode = code;
        verificationInfo.PhoneCodeExpiresAt = DateTime.UtcNow.Add(PhoneCodeExpiry);
        verificationInfo.PhoneCodeFailedAttempts = 0;
        verificationInfo.LastVerificationSmsSentAt = DateTime.UtcNow;

        await verificationInfoRepository.SaveChangesAsync(ct);

        logger.LogInformation("Phone verification generated for UserId: {UserId}", userId);
        return code;
    }

    public async Task<Result> ValidatePhoneCodeAsync(string userId, string code, CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.PhoneVerificationCode, verificationInfo.PhoneCodeExpiresAt,
            verificationInfo.PhoneCodeFailedAttempts, code,
            () => verificationInfo.PhoneCodeFailedAttempts++,
            "PhoneVerification", ct);
        
        if (result.IsFailure)
            return result;

        verificationInfo.PhoneVerificationCode = null;
        verificationInfo.PhoneCodeExpiresAt = null;
        verificationInfo.PhoneCodeFailedAttempts = 0;

        await verificationInfoRepository.SaveChangesAsync(ct);

        return Result.Success();
    }
    
    // ======================== Passord reset — Epost (steg 1) ========================
    
    /// <inheritdoc />
    public async Task<string> GenerateEmailPasswordResetAsync(string userId, CancellationToken ct = default)
    {
        // Generer 6-sifret kode for app og epost
        var code = GenerateSecureCode();

        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
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
        await verificationInfoRepository.SaveChangesAsync(ct);

        logger.LogInformation("Password reset generated for UserId: {UserId}", userId);
        return code;
    }
    
     /// <inheritdoc />
     public async Task<Result> ValidateEmailPasswordResetCodeAsync(string userId, string code,
         CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
    
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.EmailPasswordResetCode, verificationInfo.EmailPasswordResetCodeExpiresAt,
            verificationInfo.EmailPasswordResetCodeFailedAttempts, code,
            () => verificationInfo.EmailPasswordResetCodeFailedAttempts++,
            "EmailPasswordReset", ct);
        
        if (result.IsFailure)
            return result;

        // Riktig kode — nullstill koden og forsøksteller
        verificationInfo.EmailPasswordResetCode = null;
        verificationInfo.EmailPasswordResetCodeExpiresAt = null;
        verificationInfo.EmailPasswordResetCodeFailedAttempts = 0;
        verificationInfo.EmailPasswordResetVerified = true;
    
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        logger.LogInformation("Password reset email code verified for UserId: {UserId}. SMS step unlocked.",
            userId);

        return Result.Success();
    }
    
    // ======================== Passord reset — SMS (steg 2) ========================

    public async Task<string> GenerateSmsPasswordResetCodeAsync(string userId, CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
    
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
        
        await verificationInfoRepository.SaveChangesAsync(ct);
    
        logger.LogInformation(
            "SMS password reset code generated for UserId: {UserId}", userId);
    
        return code;
    }
    

   /// <inheritdoc />
   public async Task<Result> ValidateSmsPasswordResetCodeAsync(string userId, string code, 
       CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        // Guard: Epost MÅ være verifisert først
        if (!verificationInfo.EmailPasswordResetVerified)
        {
            logger.LogWarning(
                "Attempted to validate SMS password reset code without email verification for UserId: {UserId}", 
                userId);
            return Result.Failure(
                "Email verification must be completed first", AppErrorCode.Unauthorized);
        }
        
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.SmsPasswordResetCode, verificationInfo.SmsPasswordResetCodeExpiresAt,
            verificationInfo.SmsPasswordResetCodeFailedAttempts, code,
            () => verificationInfo.SmsPasswordResetCodeFailedAttempts++,
            "SmsPasswordReset", ct);
        
        if (result.IsFailure)
            return result;
        
        // Steg 2 fullført — marker SMS som verifisert for password reset
        verificationInfo.SmsPasswordResetCode = null;
        verificationInfo.SmsPasswordResetCodeExpiresAt = null;
        verificationInfo.SmsPasswordResetCodeFailedAttempts = 0;
        verificationInfo.SmsPasswordResetVerified = true;
        
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        logger.LogInformation(
            "SMS password reset code verified for UserId: {UserId}. Password reset unlocked.", userId);
        
        return Result.Success();
    }
   
    // ======================== Bytte e-post — Steg 1: Verifisering av nåværende epost ========================

    /// <inheritdoc />
    public async Task<string> GenerateOldEmailChangeCodeAsync(string userId, string newEmail,
        CancellationToken ct = default)
    {
        var code = GenerateSecureCode();
    
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
    
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
    
        await verificationInfoRepository.SaveChangesAsync(ct);
    
        logger.LogInformation("Old email change verification code generated for UserId: {UserId}", userId);
        return code;
    }

    

    /// <inheritdoc />
    public async Task<Result<string>> ValidateOldEmailChangeCodeAsync(string userId, string code,
        CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        // Ingen pending epost
        if (string.IsNullOrEmpty(verificationInfo.PendingEmail))
            return Result<string>.Failure("No pending email change found");
        
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.OldEmailChangeCode, verificationInfo.OldEmailChangeCodeExpiresAt,
            verificationInfo.OldEmailChangeCodeFailedAttempts, code,
            () => verificationInfo.OldEmailChangeCodeFailedAttempts++,
            "OldEmailChange", ct);
        
        if (result.IsFailure)
            return Result<string>.Failure(result.Error, result.AppErrorType);
        
        // Riktig kode — marker steg 1 som fullført, nullstill steg 1-koden
        verificationInfo.OldEmailChangeCode = null;
        verificationInfo.OldEmailChangeCodeExpiresAt = null;
        verificationInfo.OldEmailChangeCodeFailedAttempts = 0;
        verificationInfo.CurrentEmailChangeVerified = true;
        
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        var newEmail = verificationInfo.PendingEmail;
        
        logger.LogInformation(
            "Old email verified for email change. UserId: {UserId}. New email step unlocked.", userId);
        return Result<string>.Success(newEmail);
    }
    
    // ======================== Bytte e-post — Steg 2: Verifisering av ny epost ========================

    /// <inheritdoc />
    public async Task<string> GenerateNewEmailChangeCodeAsync(string userId, string newEmail, 
        CancellationToken ct = default)
    {
        var code = GenerateSecureCode();
    
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
    
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
    
        await verificationInfoRepository.SaveChangesAsync(ct);
    
        logger.LogInformation("New email change code generated for UserId: {UserId}", userId);
        return code;
    }
    
    /// <inheritdoc />
    public async Task<Result<string>> ValidateNewEmailChangeCodeAsync(string userId, string code, 
        CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
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
                "Current email verification must be completed first", AppErrorCode.Unauthorized);
        }
        
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.NewEmailChangeCode, verificationInfo.NewEmailChangeCodeExpiresAt,
            verificationInfo.NewEmailChangeCodeFailedAttempts, code,
            () => verificationInfo.NewEmailChangeCodeFailedAttempts++,
            "NewEmailChange", ct);
        
        if (result.IsFailure)
            return Result<string>.Failure(result.Error, result.AppErrorType);
        
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
        
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        logger.LogInformation("New email code verified for UserId: {UserId}", userId);
        return Result<string>.Success(newEmail);
    }

    // ======================== Bytte telefonnummer (innlogget) ========================

    // ======================== Bytte telefonnummer — Steg 1: Verifisering via epost ========================

    /// <inheritdoc />
    public async Task<string> GeneratePhoneChangeEmailCodeAsync(string userId, string newPhoneNumber,
        CancellationToken ct = default)
    {
        var code = GenerateSecureCode();
    
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
    
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
    
        await verificationInfoRepository.SaveChangesAsync(ct);
    
        logger.LogInformation(
            "Phone change email verification code generated for UserId: {UserId}", userId);
        return code;
    }

    /// <inheritdoc />
    public async Task<Result<string>> ValidatePhoneChangeEmailCodeAsync(string userId, string code,
        CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        // Ingen pending telefonnummer
        if (string.IsNullOrEmpty(verificationInfo.PendingPhoneNumber))
            return Result<string>.Failure("No pending phone change found");
        
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.PhoneChangeEmailCode, verificationInfo.PhoneChangeEmailCodeExpiresAt,
            verificationInfo.PhoneChangeEmailCodeFailedAttempts, code,
            () => verificationInfo.PhoneChangeEmailCodeFailedAttempts++,
            "PhoneChangeEmail", ct);
        
        if (result.IsFailure)
            return Result<string>.Failure(result.Error, result.AppErrorType);
        
        // Riktig kode — marker steg 1 som fullført, nullstill steg 1-koden
        verificationInfo.PhoneChangeEmailCode = null;
        verificationInfo.PhoneChangeEmailCodeExpiresAt = null;
        verificationInfo.PhoneChangeEmailCodeFailedAttempts = 0;
        verificationInfo.CurrentPhoneChangeVerified = true;
        
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        var newPhone = verificationInfo.PendingPhoneNumber;
        
        logger.LogInformation(
            "Email verified for phone change. UserId: {UserId}. SMS step unlocked.", userId);
        return Result<string>.Success(newPhone);
    }
    
    
    // ======================== Bytte telefonnummer — Steg 2: Verifisering av nytt nummer ========================

    /// <inheritdoc />
    public async Task<string> GenerateNewPhoneChangeCodeAsync(string userId, string newPhoneNumber,
        CancellationToken ct = default)
    {
        var code = GenerateSecureCode();
    
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
    
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
    
        await verificationInfoRepository.SaveChangesAsync(ct);
    
        logger.LogInformation("New phone change SMS code generated for UserId: {UserId}", userId);
        return code;
    }
    
    /// <inheritdoc />
    public async Task<Result<string>> ValidateNewPhoneChangeCodeAsync(string userId, string code,
        CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
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
                "Email verification must be completed first", AppErrorCode.Unauthorized);
        }
        
        // Sjekk lockout, om koden er utløpt og om koden er korrekt
        var result = await ValidateCodeAsync(userId,
            verificationInfo.NewPhoneChangeCode, verificationInfo.NewPhoneChangeCodeExpiresAt,
            verificationInfo.NewPhoneChangeCodeFailedAttempts, code,
            () => verificationInfo.NewPhoneChangeCodeFailedAttempts++,
            "NewPhoneChange", ct);
        if (result.IsFailure)
            return Result<string>.Failure(result.Error, result.AppErrorType);
        
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
        
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        logger.LogInformation("New phone code verified for UserId: {UserId}", userId);
        return Result<string>.Success(newPhone);
    }
    
    // ======================== Sikkerhetsvarsling ========================

    /// <inheritdoc />
    public async Task<string> GenerateSecurityAlertTokenAsync(string userId, CancellationToken ct = default)
    {
        // Henter verificationInfo
        var verificationInfo = await GetVerificationInfoOrThrow(userId, ct);
        
        var token = Guid.NewGuid().ToString("N"); // 32 tegn, ingen bindestreker
        
        verificationInfo.SecurityAlertToken = token;
        verificationInfo.SecurityAlertTokenExpiresAt = DateTime.UtcNow.Add(SecurityAlertTokenExpiry);
        
        await verificationInfoRepository.SaveChangesAsync(ct);
        
        logger.LogInformation("Security alert token generated for UserId: {UserId}", userId);
        return token;
    }

    /// <inheritdoc />
    public async Task<Result<string>> ValidateSecurityAlertTokenAsync(string token, CancellationToken ct = default)
    {
        var verificationInfo = await verificationInfoRepository.GetBySecurityAlertTokenAsync(token, ct);
        
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
            await verificationInfoRepository.SaveChangesAsync(ct);
            
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
        
        await verificationInfoRepository.SaveChangesAsync();
        
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
    
    /// <summary>
    /// Henter VerificationInfo for en bruker, eller kaster exception hvis den mangler.
    /// </summary>
    private async Task<VerificationInfo> GetVerificationInfoOrThrow(string userId, CancellationToken ct = default)
    {
        return await verificationInfoRepository.GetByUserIdAsync(userId, ct)
               ?? throw new InvalidOperationException(
                   $"VerificationInfo missing for UserId: {userId}. Was it created during signup?");
    }

    /// <summary>
    /// Metode som validerer den 6-sifrede Code. Brukes til alle metoder hvor den valideeres
    /// </summary>
    /// <param name="userId">BrukerensID</param>
    /// <param name="correctCode">Den korrekte koden fra databasen</param>
    /// <param name="expiresAt">Når den utgår</param>
    /// <param name="failedAttempts">Antall feilede forsøk</param>
    /// <param name="userInputCode">Brukerens kode</param>
    /// <param name="incrementAttempts">Incremental metode for å øke den relevante telleren</param>
    /// <param name="verificationMethodCallerName">Metoden som kaller valideringsmetoden</param>
    /// <param name="ct"></param>
    /// <returns>Result med Success eller Failure</returns>
    private async Task<Result> ValidateCodeAsync(
        string userId,
        string? correctCode,
        DateTime? expiresAt,
        int failedAttempts,
        string userInputCode,
        Action incrementAttempts,
        string verificationMethodCallerName,
        CancellationToken ct = default
       )
    {
        if (failedAttempts >= VerificationConfig.MaxFailedAttempts)
        {
            logger.LogWarning("{VerificationMethodCallerName} locked out for UserId: {UserId} after {Attempts} failed attempts",
                verificationMethodCallerName, userId, failedAttempts);
            return Result.Failure(
                "Too many failed attempts. Please request a new verification code.",
                AppErrorCode.TooManyRequests);
        }
    
        if (!expiresAt.HasValue || expiresAt.Value < DateTime.UtcNow || string.IsNullOrEmpty(correctCode))
            return Result.Failure("Verification code has expired");
    
        if (correctCode != userInputCode)
        {
            incrementAttempts();
            await verificationInfoRepository.SaveChangesAsync(ct);
        
            var remaining = VerificationConfig.MaxFailedAttempts - (failedAttempts + 1);
            logger.LogWarning("Invalid {SlotName} code for UserId: {UserId}. {Remaining} attempts remaining",
                verificationMethodCallerName, userId, remaining);
            return Result.Failure("Invalid verification code");
        }
    
        return Result.Success();
    }
    
    
    
}
