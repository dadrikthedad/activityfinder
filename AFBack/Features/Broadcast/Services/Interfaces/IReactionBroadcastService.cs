using AFBack.Features.Reactions.Enums;

namespace AFBack.Features.Broadcast.Services.Interfaces;


/// <summary>
/// Service for broadcasting av reaksjoner til deltakere i en samtale via SignalR og SyncEvents.
/// Håndterer både opprettelse/oppdatering og fjerning av reaksjoner med ulik payload per scenario.
/// </summary>
public interface IReactionBroadcastService
{
    // ======================================== Queue ========================================

    /// <summary>
    /// Legger en reaksjons-broadcast (Added/Updated) i bakgrunnskøen.
    /// Oppretter en ny scope og kaller <see cref="ProcessReactionBroadcastAsync"/> i bakgrunnen.
    /// </summary>
    /// <param name="reactingUserId">ID til brukeren som reagerte</param>
    /// <param name="conversationId">ID til samtalen meldingen tilhører</param>
    /// <param name="messageId">ID til meldingen det ble reagert på</param>
    /// <param name="reactionAction">ReactionAction-enum<see cref="ReactionAction.Updated"/></param>
    void QueueReactionBroadcast(string reactingUserId, int conversationId, int messageId, ReactionAction reactionAction);

    /// <summary>
    /// Legger en reaksjons-fjerning-broadcast i bakgrunnskøen.
    /// Oppretter en ny scope og kaller <see cref="ProcessReactionRemovedBroadcastAsync"/> i bakgrunnen.
    /// Lettere enn Added/Updated — krever ingen ConversationDto eller MessageDto.
    /// </summary>
    /// <param name="reactingUserId">ID til brukeren som fjernet reaksjonen</param>
    /// <param name="conversationId">ID til samtalen meldingen tilhører</param>
    /// <param name="messageId">ID til meldingen reaksjonen ble fjernet fra</param>
    void QueueReactionRemovedBroadcast(string reactingUserId, int conversationId, int messageId);

    // ======================================== Prosessering ========================================

    /// <summary>
    /// Prosesserer en reaksjons-broadcast for Added/Updated.
    /// Henter ConversationDto og MessageDto parallelt, mapper til responses,
    /// oppretter MessageNotification til meldingseieren, og broadcaster til alle aksepterte deltakere.
    /// Meldingseieren mottar payload med notification, andre deltakere mottar payload uten.
    /// </summary>
    /// <param name="reactingUserId">ID til brukeren som reagerte</param>
    /// <param name="conversationId">ID til samtalen meldingen tilhører</param>
    /// <param name="messageId">ID til meldingen det ble reagert på</param>
    /// <param name="reactionAction">ReactionAction-enum<see cref="ReactionAction.Updated"/></param>
    Task ProcessReactionBroadcastAsync(string reactingUserId, int conversationId, int messageId,
        ReactionAction reactionAction);

    /// <summary>
    /// Prosesserer en reaksjons-fjerning-broadcast.
    /// Henter kun aksepterte deltaker-IDer (lett query) og sender en minimal payload
    /// med MessageId, UserId og Emoji til alle deltakere via SignalR og SyncEvents.
    /// Ingen MessageNotification opprettes ved fjerning.
    /// </summary>
    /// <param name="reactingUserId">ID til brukeren som fjernet reaksjonen</param>
    /// <param name="conversationId">ID til samtalen meldingen tilhører</param>
    /// <param name="messageId">ID til meldingen reaksjonen ble fjernet fra</param>
    /// <returns>Task som fullføres når broadcast er sendt til alle deltakere</returns>
    Task ProcessReactionRemovedBroadcastAsync(string reactingUserId, int conversationId, int messageId);
}
