using AFBack.Common.Results;
using AFBack.Features.Messaging.DTOs.Request;

namespace AFBack.Features.Messaging.Validators;

public interface ISendMessageValidator
{
    /// <summary>
    /// Hovedvalideringsmetoden som kaller de andre valideringene. Brukes i SendMessageAsync.
    /// </summary>
    /// <param name="request">SendMessageRequest</param>
    /// <param name="senderId">Brukeren som sender melding</param>
    /// <returns>Result med success eller result med errorMessage</returns>
    Task<Result> ValidateSendMessageAsync(string senderId, MessageRequest request);
}
