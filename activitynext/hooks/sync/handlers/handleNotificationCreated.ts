// handlers/handleNotificationCreated.ts
import { handleIncomingNotification } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";

/**
 * Handle NOTIFICATION_CREATED sync event
 * Reuses existing handleIncomingNotification logic
 */
export async function handleNotificationCreated(eventData: MessageNotificationDTO): Promise<void> {
  console.log(`📨 Handling NOTIFICATION_CREATED sync event`, { 
    notificationId: eventData.id,
    conversationId: eventData.conversationId 
  });

  try {
    await handleIncomingNotification(eventData);
    
    console.log(`✅ Successfully handled NOTIFICATION_CREATED sync event for notification ${eventData.id}`);
  } catch (error) {
    console.error(`❌ Failed to handle NOTIFICATION_CREATED sync event:`, error);
  }
}