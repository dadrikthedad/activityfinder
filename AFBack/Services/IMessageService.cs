using AFBack.DTOs;
using AFBack.Models;

namespace AFBack.Services;

public interface IMessageService
{
    Task<MessageResponseDTO> SendMessageAsync(int senderId, SendMessageRequestDTO requestDto);

    Task<List<MessageResponseDTO>> GetMessagesForConversationAsync(int conversationId, int userId, int skip = 0,
        int take = 20);

    Task<List<MessageRequestDTO>> GetPendingMessageRequestsAsync(int receiverId);
    
    Task DeclineMessageRequestAsync(int receiverId, int senderId);

    Task ApproveMessageRequestAsync(int receiverId, int senderId);

    Task<bool> UnblockUserAsync(int blockerId, int blockedUserId);
    Task<List<BlockedUserDTO>> GetBlockedUsersAsync(int userId);
    Task<bool> BlockUserAsync(int blockerId, int blockedUserId);
    
    Task AcceptGroupInviteAsync(int userId, int conversationId);
    Task DeclineGroupInviteAsync(int userId, int conversationId);
    Task<List<BlockedGroupDTO>> GetBlockedGroupsAsync(int userId);
    Task UnblockGroupAsync(int userId, int conversationId);
    Task SoftDeleteMessageAsync(int messageId, int userId);

}
