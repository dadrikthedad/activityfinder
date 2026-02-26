using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services.Interfaces;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.FileHandling.Constants;
using AFBack.Features.FileHandling.DTOs.Responses;
using AFBack.Features.FileHandling.Services;
using AFBack.Infrastructure.Email;
using AFBack.Infrastructure.Email.Enums;
using AFBack.Infrastructure.Email.Models;
using AFBack.Infrastructure.Email.Templates;
using AFBack.Infrastructure.Security.Enums;
using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Sms.Enums;
using AFBack.Infrastructure.Sms.Services;
using Microsoft.AspNetCore.Identity;

namespace AFBack.Features.Account.Services;

public class AccountChangeService(
    UserManager<AppUser> userManager,
    ILogger<AccountChangeService> logger,
    IConfiguration configuration,
    IVerificationInfoService verificationInfoService,
    IVerificationInfoRepository verificationInfoRepository,
    IUserRepository userRepository,
    IEmailService emailService,
    ISmsService smsService,
    IEmailRateLimitService emailRateLimitService,
    ISmsRateLimitService smsRateLimitService,
    ISuspiciousActivityService suspiciousActivityService,
    IProfileBroadcastService profileBroadcastService,
    IFileOrchestrator fileOrchestrator,
    IRateLimitGuardService rateLimitGuardService) : IAccountChangeService
{
    // ======================== Bytte e-post — Steg 1 ======================== 

    /// <inheritdoc/>
    public async Task<Result> RequestEmailChangeAsync(string userId, string currentPassword, 
        string newEmail, string ipAddress)
    {
        logger.LogInformation("RequestEmailChangeAsync. UserId: {UserId}", userId);
        
        // ====== Rate limit ======
        var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.EmailChange, 
            newEmail, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);
        
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
        var code = await verificationInfoService.GenerateOldEmailChangeCodeAsync(user.Id, newEmail);
        
        // Generer security alert token for "This wasn't me"-knappen
        var alertToken = await verificationInfoService.GenerateSecurityAlertTokenAsync(user.Id);
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
    
    // ======================== Bytte e-post — Steg 2 ======================== 
    
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
        var validateResult = await verificationInfoService.ValidateOldEmailChangeCodeAsync(user.Id, code);
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
        var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.EmailChange, 
            newEmail, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);
        
        // ====== Send verifiseringskode til NY epost ======
        var newCode = await verificationInfoService.GenerateNewEmailChangeCodeAsync(user.Id, newEmail);
        
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

    // ======================== Bytte e-post — Steg 3 ======================== 

    /// <inheritdoc/>
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
        var validateResult = await verificationInfoService.ValidateNewEmailChangeCodeAsync(user.Id, code);
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
        var verificationInfo = await verificationInfoRepository.GetByUserIdAsync(user.Id);
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

    // ======================== Bytte telefonnummer — Steg 1 ======================== 

   /// <inheritdoc/>
    public async Task<Result> RequestPhoneChangeAsync(string userId, string currentPassword, 
        string newPhoneNumber, string ipAddress)
    {
        logger.LogInformation("RequestPhoneChangeAsync. UserId: {UserId}", userId);
        
        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("Change phone requested for non-existent UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ====== Rate limit (epost, ikke SMS — steg 1 sendes via epost) ======
        var rateLimitResult = await rateLimitGuardService.CheckEmailRateLimitAsync(EmailType.PhoneChange, 
            user.Email!, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);
        
        
        
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
        var code = await verificationInfoService.GeneratePhoneChangeEmailCodeAsync(user.Id, newPhoneNumber);
        
        // Generer security alert token for "This wasn't me"-knappen
        var alertToken = await verificationInfoService.GenerateSecurityAlertTokenAsync(user.Id);
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
    
    // ======================== Bytte telefonnummer — Steg 2 ======================== 
    
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
        var validateResult = await verificationInfoService.ValidatePhoneChangeEmailCodeAsync(user.Id, code);
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
        var rateLimitResult = await rateLimitGuardService.CheckSmsRateLimitAsync(SmsType.PhoneChange, 
            newPhoneNumber, ipAddress);
        if (rateLimitResult.IsFailure)
            return Result.Failure(rateLimitResult.Error, rateLimitResult.ErrorType);
        
        // ====== Send SMS-kode til NYTT nummer ======
        var smsCode = await verificationInfoService.GenerateNewPhoneChangeCodeAsync(user.Id, newPhoneNumber);
        
        var message = $"Your Koptr verification code is: {smsCode}";
        var result = await smsService.SendAsync(newPhoneNumber, message);
        
        if (result.IsSuccess)
            smsRateLimitService.RegisterSmsSent(SmsType.PhoneChange, newPhoneNumber, ipAddress);
        
        logger.LogInformation(
            "Phone change SMS sent to {NewPhone} for UserId: {UserId}", newPhoneNumber, userId);
        return Result.Success();
    }

    // ======================== Bytte telefonnummer — Steg 3 ======================== 

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
        var validateResult = await verificationInfoService.ValidateNewPhoneChangeCodeAsync(user.Id, code);
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
        var verificationInfo = await verificationInfoRepository.GetByUserIdAsync(user.Id);
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
    
    // ======================== Bytte navn ======================== 
    /// <inheritdoc/>
    public async Task<Result> UpdateNameAsync(string userId, string firstName, string lastName)
    {
        logger.LogInformation("ChangeNameAsync. UserId: {UserId}", userId);

        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("User not found. UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }

        // ====== Oppdater navn ======
        user.FirstName = firstName;
        user.LastName = lastName;
        user.FullName = $"{firstName} {lastName}";

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            logger.LogError("Failed to update name for UserId: {UserId}. Errors: {Errors}", userId, errors);
            return Result.Failure("Failed to update name");
        }

        // ====== Broadcaster til alle venner/samtalepartnere + egne enheter ======
        await profileBroadcastService.BroadcastProfileUpdatedAsync(userId, user.FullName, user.ProfileImageUrl);

        logger.LogInformation("Name changed to {FullName} for UserId: {UserId}", user.FullName, userId);
        return Result.Success();
    }
    
    // ======================== Bytte Profile Image ======================== 
    /// <inheritdoc/>
    public async Task<Result<FileUrlResponse>> UpdateProfileImageAsync(string userId, IFormFile image)
    {
        logger.LogInformation("UpdateProfileImage. UserId: {UserId}", userId);

        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("User not found. UserId: {UserId}", userId);
            return Result<FileUrlResponse>.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        var storageKey = StorageKeys.ProfileImage(userId);
        
        // Valider og last opp filen som en stream
        var uploadImageResult = await fileOrchestrator.UploadPublicImageAsync(image, storageKey);
        if (uploadImageResult.IsFailure)
            return Result<FileUrlResponse>.Failure(uploadImageResult.Error);
        var imageUrl = uploadImageResult.Value;
        
        // ====== Oppdater profileimage ======
        user.ProfileImageUrl = imageUrl;
        
        
        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            logger.LogError("Failed to update profileImage for UserId: {UserId}. Errors: {Errors}", userId, errors);
            return Result<FileUrlResponse>.Failure("Failed to update profile image");
        }

        // ====== Broadcaster til alle venner/samtalepartnere + egne enheter ======
        await profileBroadcastService.BroadcastProfileUpdatedAsync(userId, user.FullName, user.ProfileImageUrl);

        logger.LogInformation("ProfileImage changed for UserId: {UserId}", userId);
        return Result<FileUrlResponse>.Success(new FileUrlResponse { FileUrl = imageUrl!});
    }
    
    // ======================== Fjerne Profile Image ======================== 
    /// <inheritdoc/>
    public async Task<Result> RemoveProfileImageAsync(string userId)
    {
        logger.LogInformation("RemoveProfileImage. UserId: {UserId}", userId);

        // ====== Finn bruker ======
        var user = await userManager.FindByIdAsync(userId);
        if (user == null)
        {
            logger.LogWarning("User not found. UserId: {UserId}", userId);
            return Result.Failure("User not found", ErrorTypeEnum.NotFound);
        }
    
        if (string.IsNullOrWhiteSpace(user.ProfileImageUrl))
        {
            logger.LogWarning("User {UserId} tried to remove profile image but none exists", userId);
            return Result.Failure("No profile image to remove", ErrorTypeEnum.BadRequest);
        }
    
        // ====== Storage: Slett bildet ======
        var storageKey = StorageKeys.ProfileImage(userId);
        var deleteResult = await fileOrchestrator.DeletePublicImageAsync(storageKey);
        if (deleteResult.IsFailure)
        {
            logger.LogError("Failed to delete profile image from storage for UserId: {UserId}. Error: {Error}",
                userId, deleteResult.Error);
            return Result.Failure(deleteResult.Error, deleteResult.ErrorType);
        }
    
        // ====== Oppdater database ======
        user.ProfileImageUrl = null;
    
        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            logger.LogError("Failed to remove profileImage for UserId: {UserId}. Errors: {Errors}", userId, errors);
            return Result.Failure("Failed to remove profile image");
        }

        // ====== Broadcaster til alle venner/samtalepartnere + egne enheter ======
        await profileBroadcastService.BroadcastProfileUpdatedAsync(userId, user.FullName, user.ProfileImageUrl);

        logger.LogInformation("ProfileImage removed for UserId: {UserId}", userId);
        return Result.Success();
    }
    
}
