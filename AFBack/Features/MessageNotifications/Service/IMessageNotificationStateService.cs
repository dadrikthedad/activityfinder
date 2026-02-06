using AFBack.Common.Results;

namespace AFBack.Features.MessageNotifications.Service;

public interface IMessageNotificationStateService
{
    /// <summary>
    /// Henter en MessageNotification for oppdatering (med tracking, uten Include).
    /// Brukes for tilstandsendringer som å markere som lest.
    /// </summary>
    /// <param name="userId">Brukeren som har lest notifikasjonen</param>
    /// <param name="messageNotificationId">ID-en til MessageNotification</param>
    /// <returns>MessageNotification eller null hvis ikke funnet</returns>
    Task<Result> MarkAsReadAsync(string userId, int messageNotificationId);
    
    /// <summary>
    /// Markerer alle uleste MessageNotifications som lest for en bruker i en spesifikk samtale.
    /// Idempotent - returnerer suksess selv om ingen uleste finnes.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <param name="conversationId">Samtalens ID</param>
    /// <returns>Result som indikerer suksess eller feil</returns>
    Task<Result> MarkAllAsReadByConversationAsync(string userId, int conversationId);
    
    /// <summary>
    /// Markerer alle uleste MessageNotifications som lest for en bruker.
    /// Idempotent - returnerer suksess selv om ingen uleste finnes.
    /// </summary>
    /// <param name="userId">Brukerens ID</param>
    /// <returns>Result som indikerer suksess eller feil</returns>
    Task<Result> MarkAllAsReadAsync(string userId);
}
