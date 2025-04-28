using AFBack.DTOs;

namespace AFBack.Services;

public interface IMessageService
{
    Task<MessageResponseDTO> SendMessageAsync(string senderId, SendMessageRequestDTO requestDto);
    Task<List<MessageResponseDTO>> GetMessagesForUserAsync(string userId);
}
