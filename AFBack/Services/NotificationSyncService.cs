using AFBack.Constants;
using AFBack.Models;

namespace AFBack.Services;

public class NotificationSyncService
{
    
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationSyncService> _logger;

    public NotificationSyncService(
        IBackgroundTaskQueue taskQueue, 
        IServiceScopeFactory scopeFactory,
        ILogger<NotificationSyncService> logger)
    {
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }
    
    // Hjelpemetode for å lage en notifikasjon til å lage en sync event til hver notifikasjon blir laget
    public void QueueNotificationSyncEvent(MessageNotificationDTO notification, int receiverUserId)
    {
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();

            try 
            {
                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.MESSAGE_NOTIFICATION_CREATED,
                    eventData: notification,
                    singleUserId: receiverUserId, // 👈 Bruk parameteren
                    source: "API",
                    relatedEntityId: notification.Id,
                    relatedEntityType: "MessageNotification"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create sync event for notification {NotificationId}", notification.Id);
            }
        });
    }
}