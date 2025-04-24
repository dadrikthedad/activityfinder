namespace AFBack.Services;

public interface INotificationService
{
    Task CreateNotificationAsync(int recipientUserId, int? relatedUserId, string type, string? message = null);
}