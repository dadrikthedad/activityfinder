using AFBack.Features.Auth.Models;
using AFBack.Features.Auth.Repositories;
using AFBack.Features.Auth.Services.Interfaces;

namespace AFBack.Features.Auth.Services;

public class LoginHistoryService(
    ILogger<LoginHistoryService> logger,
    ILoginHistoryRepository loginHistoryRepository) : ILoginHistoryService
{
    /// <inheritdoc/>
    public async Task RecordLoginAsync(string userId, int deviceId, string ipAddress, string? userAgent)
    {
        var entry = new LoginHistory
        {
            UserId = userId,
            UserDeviceId = deviceId,
            IpAddress = ipAddress,
            UserAgent = userAgent
        };
        
        await loginHistoryRepository.AddAsync(entry);
        logger.LogInformation("LoginHistory created for user {UserId}", userId);
    }
    
    /// <inheritdoc/>
    public async Task RecordLogoutAsync(string userId, int deviceId)
    {
        var loginHistory = await loginHistoryRepository.GetActiveLoginAsync(userId, deviceId);

        if (loginHistory == null)
        {
            logger.LogWarning("No active login found for UserId: {UserId}, DeviceId: {DeviceId}", userId, deviceId);
            return;
        }

        loginHistory.LogoutAt = DateTime.UtcNow;
        await loginHistoryRepository.SaveChangesAsync();
        
        logger.LogInformation("Logout recorded for UserId: {UserId}, DeviceId: {DeviceId}", userId, deviceId);
    }
    
    /// <inheritdoc/>
    public async Task RecordLogoutAllAsync(string userId)
    {
        var activeLogins = await loginHistoryRepository.GetActiveLoginsByUserIdAsync(userId);
    
        foreach (var login in activeLogins)
        {
            login.LogoutAt = DateTime.UtcNow;
        }
    
        await loginHistoryRepository.SaveChangesAsync();
    
        logger.LogInformation("All active logins closed for UserId: {UserId}, Count: {Count}", 
            userId, activeLogins.Count);
    }
}
