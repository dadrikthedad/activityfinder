namespace AFBack.Features.MessageBroadcast.Interface;

public interface IMessageBroadcastService
{
    /// <summary>
    /// Her queuer vi SignalR, notifications og syncevents etter vi har sendt en melding
    /// </summary>
    /// <param name="messageId">Meldingen som er sendt</param>
    /// <param name="conversationId">Samtalen meldingen er sendt i</param>
    /// <param name="senderId">Avsender</param>
    void QueueNewMessageBackgroundTasks(int messageId, int conversationId,
        string? senderId);

    /// <summary>
    /// Her setter vi opp og organiserer rekkefølgen vi sender meldinger.
    /// 1. SignalR
    /// 2. MessageNotification
    /// 3. SyncEvent
    /// </summary>
    /// <param name="messageId">Meldingen vi henter ut igjen i bakgrunnsjobben</param>
    /// <param name="conversationId">Samtalen vi henter participants fra</param>
    /// <param name="senderId">Brukeren som har sendt meldingen for filtrering fra SignalR og Notifikasjon</param>
    Task ProcessMessageBroadcast(int messageId, int conversationId, string? senderId);

}
