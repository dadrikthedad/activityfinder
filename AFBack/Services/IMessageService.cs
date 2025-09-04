using AFBack.DTOs;
using AFBack.DTOs.Crypto;
using AFBack.Models;

namespace AFBack.Services;

public interface IMessageService
{
    Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO requestDto);

    Task<List<MessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int userId, int skip = 0,
        int take = 20);

    Task<PaginatedMessageRequestsDTO> GetPendingMessageRequestsAsync(int receiverId, int page = 1,
        int pageSize = 10);

    Task ApproveMessageRequestAsync(int receiverId, int conversationId);

    Task<List<MessageResponseDTO>> SearchMessagesInConversationAsync(int conversationId, int userId, string query,
        int skip = 0, int take = 50);

    Task<MessageResponseDTO> SoftDeleteMessageAsync(int messageId, int userId);
    Task<MessageResponseDTO> MapToResponseDtoOptimized(int messageId);

    Task<EncryptedMessageResponseDTO> SendEncryptedMessageAsync(int senderId, SendEncryptedMessageRequestDTO dto);

}
