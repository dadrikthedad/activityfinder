using AFBack.DTOs.BoostrapDTO.Sync;
using AFBack.Extensions;

namespace AFBack.Interface.Services;

public interface ISyncService
{
    string GenerateSyncToken();

    bool ValidateTokenHash(SyncEventExtensions.SyncToken token);
    SyncEventExtensions.SyncToken? ParseSyncToken(string tokenString);

    Task<string> CreateSyncEventAsync(int userId, string eventType, object eventData, string? source = null,
        int? relatedEntityId = null, string? relatedEntityType = null);

    Task<string> CreateSyncEventsForMultipleUsersAsync(
        IEnumerable<int> userIds,
        string eventType,
        object eventData,
        string? source = null,
        int? relatedEntityId = null,
        string? relatedEntityType = null);

    Task<SyncResponseDTO> GetEventsSinceAsync(int userId, string? sinceSyncToken);

    string ReserializeEventData(string eventData);

    Task CleanupOldEventsAsync();

    Task CreateAndDistributeSyncEventAsync(
        string eventType,
        object eventData,
        IEnumerable<int>? targetUserIds = null, // Hvis null, bruk singleUserId
        int? singleUserId = null, // For single user events
        string? source = null,
        int? relatedEntityId = null,
        string? relatedEntityType = null);
}