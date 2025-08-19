import { handleIncomingNotification } from "@/utils/messages/getNotificationsBeforeSignalr";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";

/**
 * Transform notification from sync format (PascalCase) to frontend format (camelCase)
 */
const transformSyncNotification = (syncNotification: any): MessageNotificationDTO => {
  return {
    id: syncNotification.Id || syncNotification.id,
    type: syncNotification.Type || syncNotification.type,
    isRead: syncNotification.IsRead || syncNotification.isRead,
    createdAt: syncNotification.CreatedAt || syncNotification.createdAt,
    readAt: syncNotification.ReadAt || syncNotification.readAt,
    messageId: syncNotification.MessageId || syncNotification.messageId,
    conversationId: syncNotification.ConversationId || syncNotification.conversationId,
    senderId: syncNotification.SenderId || syncNotification.senderId,
    senderName: syncNotification.SenderName || syncNotification.senderName,
    senderProfileImageUrl: syncNotification.SenderProfileImageUrl || syncNotification.senderProfileImageUrl,
    groupName: syncNotification.GroupName || syncNotification.groupName,
    groupImageUrl: syncNotification.GroupImageUrl || syncNotification.groupImageUrl,
    reactionEmoji: syncNotification.reactionEmoji || syncNotification.ReactionEmoji,
    isReactionUpdate: syncNotification.IsReactionUpdate || syncNotification.isReactionUpdate,
    messagePreview: syncNotification.MessagePreview || syncNotification.messagePreview,
    messageCount: syncNotification.MessageCount || syncNotification.messageCount,
    isConversationRejected: syncNotification.IsConversationRejected || syncNotification.isConversationRejected,
    eventCount: syncNotification.EventCount || syncNotification.eventCount,
    lastUpdatedAt: syncNotification.LastUpdatedAt || syncNotification.lastUpdatedAt,
    eventSummaries: syncNotification.EventSummaries || syncNotification.eventSummaries,
    latestGroupEventType: syncNotification.LatestGroupEventType || syncNotification.latestGroupEventType,
    latestAffectedUsers: syncNotification.LatestAffectedUsers || syncNotification.latestAffectedUsers
  };
};

/**
 * Handle notification created sync event
 */
export const handleNotificationCreated = async (eventData: any) => {
  console.log("🍌 BANAN: Raw notification data:", {
    eventData: eventData,
    keys: Object.keys(eventData),
    hasId: !!eventData.Id || !!eventData.id,
    hasConversationId: !!eventData.ConversationId || !!eventData.conversationId
  });

  // Transform the notification data
  const transformedNotification = transformSyncNotification(eventData);

  console.log("🍌 BANAN: Transformed notification:", {
    id: transformedNotification.id,
    conversationId: transformedNotification.conversationId,
    type: transformedNotification.type,
    messagePreview: transformedNotification.messagePreview
  });

  console.log(`📨 Handling NOTIFICATION_CREATED sync event`, {
    notificationId: transformedNotification.id,
    conversationId: transformedNotification.conversationId
  });

  try {
    await handleIncomingNotification(transformedNotification);
    console.log(`✅ Successfully handled NOTIFICATION_CREATED sync event for notification ${transformedNotification.id}`);
  } catch (error) {
    console.error(`❌ Failed to handle NOTIFICATION_CREATED sync event:`, error);
  }
};