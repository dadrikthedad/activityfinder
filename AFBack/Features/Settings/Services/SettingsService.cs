using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Settings.DTOs.Requests;
using AFBack.Features.Settings.DTOs.Responses;
using AFBack.Features.Settings.Extensions;
using AFBack.Features.Settings.Repositories;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;

namespace AFBack.Features.Settings.Services;

public class SettingsService(
    ILogger<SettingsService> logger,
    ISettingsRepository settingsRepository,
    ISyncService syncService) : ISettingsService
{
    // ======================== GET ======================== 
    /// <inheritdoc/>
    public async Task<Result<SettingsResponse>> GetSettingsAsync(string userId)
    {
        var settings = await settingsRepository.GetByUserIdAsync(userId);
        if (settings == null)
            return Result<SettingsResponse>.Failure("Settings not found", AppErrorCode.NotFound);

        return Result<SettingsResponse>.Success(settings.ToResponse());
    }
    
    // ======================== Update ======================== 
    
    /// <inheritdoc/>
    public async Task<Result> UpdateSettingsAsync(string userId, UpdateSettingsRequest request)
    {
        logger.LogInformation("User {UserId} is updating settings", userId);

        var settings = await settingsRepository.GetByUserIdAsync(userId);
        if (settings == null)
        {
            logger.LogWarning("UserSettings for {UserId} does not exist", userId);
            return Result.Failure("Settings not found", AppErrorCode.NotFound);
        }

        settings.Language = request.Language;
        settings.PublicProfile = request.PublicProfile;
        settings.ShowAge = request.ShowAge;
        settings.ShowBirthday = request.ShowBirthday;
        settings.ShowGender = request.ShowGender;
        settings.ShowEmail = request.ShowEmail;
        settings.ShowPhone = request.ShowPhone;
        settings.ShowRegion = request.ShowRegion;
        settings.ShowBio = request.ShowBio;
        settings.ShowStats = request.ShowStats;
        settings.ShowWebsites = request.ShowWebsites;
        settings.ShowPostalCode = request.ShowPostalCode;
        settings.ReceiveEmailNotifications = request.ReceiveEmailNotifications;
        settings.ReceivePushNotifications = request.ReceivePushNotifications;

        await settingsRepository.SaveChangesAsync();

        await syncService.CreateSyncEventsAsync([userId],
            SyncEventType.MySettingsUpdated, settings.ToResponse());

        logger.LogInformation("User {UserId} updated settings successfully", userId);
        return Result.Success();
    }
}
