using AFBack.Features.SendMessage.DTOs;
using AFBack.Models;

namespace AFBack.Features.SendMessage.Interface;

public interface ISendMessageService
{
    Task<SendMessageResponse> SendMessageAsync(SendMessageRequest request, int userId);


}
