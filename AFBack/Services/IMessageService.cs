using AFBack.DTOs;
using AFBack.Models;

namespace AFBack.Services;

public interface IMessageService
{
    Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO requestDto);

    Task<List<MessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int userId, int skip = 0,
        int take = 20);

    Task<List<MessageRequestDTO>> GetPendingMessageRequestsAsync(int receiverId);

    Task ApproveMessageRequestAsync(int receiverId, int senderId);
    
    Task SoftDeleteMessageAsync(int messageId, int userId);

    Task<List<MessageResponseDTO>> SearchMessagesInConversationAsync(int conversationId, int userId, string query,
        int skip = 0, int take = 50);

}
