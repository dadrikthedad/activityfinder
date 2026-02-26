using AFBack.Common.Results;
using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.Messaging.Services;

public interface IMessageQueryService
{
    /// <summary>
    /// Henter meldinger for en samtale med paginering.
    /// Validerer at brukeren er deltaker i samtalen med Accepted status.
    /// Bruker UserSummaryCache for rask oppslag av avsenderinfo.
    /// </summary>
    /// <param name="userId">Brukeren som henter meldinger</param>
    /// <param name="conversationId">Samtalen meldingene tilhører</param>
    /// <param name="page">Sidenummer (1-indeksert)</param>
    /// <param name="pageSize">Antall meldinger per side</param>
    /// <returns>MessagesResponse med paginert liste av meldinger</returns>
    Task<Result<MessagesResponse>> GetMessagesAsync(string userId, int conversationId, int page, int pageSize);
    
    /// <summary>
    /// Henter meldinger for flere samtaler samtidig - optimalisert for initial load.
    /// Validerer at brukeren er deltaker i alle samtalene.
    /// Bruker UserSummaryCache for rask oppslag av avsenderinfo.
    /// </summary>
    /// <param name="userId">Brukeren som henter meldinger</param>
    /// <param name="conversationIds">Liste med samtale-IDer</param>
    /// <param name="messagesPerConversation">Antall meldinger per samtale</param>
    /// <returns>Dictionary med conversationId som nøkkel og liste med MessageResponse som verdi</returns>
    Task<Result<Dictionary<int, List<MessageResponse>>>> GetMessagesForConversationsAsync(
        string userId, List<int> conversationIds, int messagesPerConversation);
    
    /// <summary>
    /// Sletter en melding (soft delete). Kun avsender kan slette egne meldinger.
    /// Sender SignalR til alle aksepterte deltakere og oppretter SyncEvents.
    /// </summary>
    /// <param name="userId">Brukeren som prøver å slette</param>
    /// <param name="messageId">Meldingen som skal slettes</param>
    /// <returns>Result ved suksess</returns>
    Task<Result> DeleteMessageAsync(string userId, int messageId);
}
