using AFBack.Common.Results;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;

namespace AFBack.Features.Messaging.Interface;

public interface ISendMessageValidator
{
    Task<Result> ValidateSendMessageAsync(string userId, MessageRequest request);
}
