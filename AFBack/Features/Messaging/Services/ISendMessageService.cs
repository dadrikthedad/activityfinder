using AFBack.Common.Results;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.Messaging.Services;

public interface ISendMessageService
{
    /// <summary>
    /// Validerer og lagrer en melding i databasen, samt setter singalr og syncevent-opprettelse i kø etter rask response
    /// </summary>
    /// <param name="request">SendMessageRequest</param>
    /// <param name="userId"></param>
    /// <returns>SendMessageResponse</returns>
    Task<Result<SendMessageResponse>> SendMessageAsync(MessageRequest request, string userId);

    /// <summary>
    /// Oppretter en systemmelding og sender den via med MessageBroadcastService
    /// </summary>
    /// <param name="conversationId">Samtalen som skal ha systemmeldingen</param>
    /// <param name="messageText">Meldingsteksten</param>
    Task SendSystemMessageAsync(int conversationId, string messageText);


}
