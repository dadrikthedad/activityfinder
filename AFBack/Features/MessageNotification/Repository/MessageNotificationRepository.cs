using AFBack.Data;
using AFBack.Features.Conversation.DTOs;
using AFBack.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.MessageNotification.Repository;

public class MessageNotificationRepository(ApplicationDbContext context) : IMessageNotificationRepository
{
    
    // Sjekk interface for summary
    public async Task<Models.MessageNotification?> GetMessageNotificationAsync(string recipientId, string senderId,
        ConversationResponse conversationResponse)
        => await context.MessageNotifications
            .FirstOrDefaultAsync(mn => mn.RecipientId == recipientId &&
                                       mn.ConversationId == conversationResponse.Id &&
                                       !mn.IsRead &&
                                       mn.Type == MessageNotificationType.NewMessage &&
                                       (conversationResponse.Type == ConversationType.GroupChat ||
                                            mn.SenderId == senderId));
    
    
    // Sjekk interface for summary
    public async Task CreateMessageNotificationAsync(Models.MessageNotification notification)
    {
        await context.MessageNotifications.AddAsync(notification);
        await context.SaveChangesAsync();
    }
    
    // Sjekk interface for summary
    public async Task SaveMessageNotificationAsync() => await context.SaveChangesAsync();

}
