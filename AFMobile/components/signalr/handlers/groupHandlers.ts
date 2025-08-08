// groupHandlers.ts - Alle group-relaterte handlers (uten any types)
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { GroupRequestCreatedDto } from "@shared/types/GroupRequestDTO";
import { GroupNotificationUpdateDTO, GroupEventType } from "@shared/types/GroupNotificationUpdateDTO";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";
import { GroupDisbandedDto } from "@shared/types/GroupDisbandedDTO";
import { showNotificationToastNative } from "@/components/toast/NotificationToastNative";
import { handleIncomingNotification } from "@/utils/messages/getNotificationsBeforeSignalr";
import { NotificationType } from "@shared/types/MessageNotificationDTO";

// Types for function parameters
type CheckAndExecuteFunction = (callback: () => Promise<void>) => Promise<void>;
type SyncPendingConversationFunction = (conversationId: number, forceRefresh?: boolean) => Promise<unknown>;
type RefreshConversationFunction = (conversationId: number, options?: { logPrefix?: string }) => Promise<unknown>;

// Mottat en gruppeforespørsler
export const handleGroupRequestCreated = async (
  data: GroupRequestCreatedDto,
  userId: number | null,
  checkAndExecute: CheckAndExecuteFunction,
  syncPendingConversation: SyncPendingConversationFunction
) => {
  await checkAndExecute(async () => {
    if (data.notification) {
      await handleIncomingNotification(data.notification);
      await syncPendingConversation(data.conversationId);
      
      if (data.notification.senderId !== userId) {
        showNotificationToastNative({
          messagePreview: data.notification.messagePreview,
          type: NotificationType.GroupRequest,
          conversationId: data.conversationId,
          groupName: data.groupName,
          groupImage: data.notification.groupImageUrl,
          senderName: data.notification.senderName || "Someone",
          senderProfileImage: data.notification.senderProfileImageUrl || "/default-avatar.png"
        });
      }
    }
  });
};

export const handleGroupNotificationUpdated = async (
  data: GroupNotificationUpdateDTO,
  userId: number | null,
  refreshConversation: RefreshConversationFunction
) => {
  console.log("🔔 GroupNotification oppdatert i SignalRClient:", data);
  const { userId: targetUserId, notification, groupEventType, affectedUsers } = data;

  if (targetUserId !== userId) {
    console.log("⚠️ GroupNotification ikke for denne brukeren, hopper over");
    return;
  }

  if (notification) {
    const enhancedNotification: MessageNotificationDTO = {
      ...notification,
      latestGroupEventType: typeof groupEventType === 'string' ? groupEventType : String(groupEventType),
      latestAffectedUsers: affectedUsers
    };

    let eventTypeEnum: GroupEventType;
    if (typeof groupEventType === 'string') {
      eventTypeEnum = GroupEventType[groupEventType as keyof typeof GroupEventType];
    } else {
      eventTypeEnum = groupEventType;
    }

    if (notification.conversationId != null) {
      await refreshConversation(notification.conversationId, {
        logPrefix: "👥"
      });
    }

    await handleIncomingNotification(enhancedNotification);

    if (notification.conversationId != null) {
      showNotificationToastNative({
        senderName: notification.senderName ?? "Someone",
        type: NotificationType.GroupEvent,
        conversationId: notification.conversationId,
        groupName: notification.groupName,
        groupImage: notification.groupImageUrl,
        groupEventType: eventTypeEnum,
        affectedUsers: affectedUsers,
      });
    }
  }
};

export const handleGroupDisbanded = async (
  data: GroupDisbandedDto,
  currentConversationId: number | null
) => {
  console.log("💥 Gruppe disbanded via useChatHub:", data);
  const { conversationId, groupName, notification } = data;
  
  const { 
    removeConversation, 
    removePendingRequest, 
    setCurrentConversationId 
  } = useChatStore.getState();

  const { updateNotificationsForRejectedConversation } = useMessageNotificationStore.getState();
  
  removeConversation(conversationId);
  removePendingRequest(conversationId); 
  
  if (currentConversationId === conversationId) {
    setCurrentConversationId(null);
  }

  updateNotificationsForRejectedConversation(conversationId);
  
  if (notification) {
    await handleIncomingNotification(notification);
    
    showNotificationToastNative({
      senderName: "System",
      messagePreview: `Group "${groupName}" has been disbanded`,
      type: NotificationType.GroupDisbanded,
      conversationId,
      groupName: groupName,
    });
  }
  
  console.log(`✅ Fjernet disbanded gruppe ${conversationId} fra store`);
};

export const handleGroupParticipantsUpdated = async (
  conversationId: number,
  syncPendingConversation: SyncPendingConversationFunction
) => {
  console.log("🔁 Group participants updated via useChatHub for conversation:", conversationId);
  await syncPendingConversation(conversationId, true);
};