namespace AFBack.Features.MessageBroadcast.Interface;

public interface IDeleteMessageBroadcastService
{
    /// <summary>
    /// Queuer SignalR og SyncEvents etter en melding er slettet
    /// </summary>
    /// <param name="messageId">Meldingen som ble slettet</param>
    /// <param name="conversationId">Samtalen meldingen tilhørte</param>
    /// <param name="deletedByUserId">Brukeren som slettet meldingen</param>
    void QueueDeleteMessageBroadcast(int messageId, int conversationId, string deletedByUserId);
    
    /// <summary>
    /// Prosesserer broadcast av slettet melding.
    /// Sender SignalR til aksepterte deltakere og oppretter SyncEvents.
    /// </summary>
    /// <param name="messageId">Meldingen som ble slettet</param>
    /// <param name="conversationId">Samtalen meldingen tilhørte</param>
    /// <param name="deletedByUserId">Brukeren som slettet meldingen</param>
    Task ProcessDeleteMessageBroadcastAsync(int messageId, int conversationId, string deletedByUserId);
}
