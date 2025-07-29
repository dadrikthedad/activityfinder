// messageHandlers.ts - Alle message-relaterte handlers (med riktige eksisterende types)
import { useChatStore } from "@/store/useChatStore";
import { MessageDTO, ReactionDTO } from "@/types/MessageDTO";
import { MessageRequestCreatedDto } from "@/types/MessageRequestCreatedDto";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { handleIncomingMessage } from "../handleIncomingMessage";
import { handleIncomingReaction } from "../handleIncomingReactions";
import { showNotificationToast } from "@/components/toast/Toast";
import { handleIncomingNotification } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { NotificationType } from "@/types/MessageNotificationDTO";
import truncateText from "@/services/helpfunctions/truncateMsgTextForToast";
import { preloadMessagesForConversation } from "@/functions/SignalR/PreloadMessagesForConversation";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";

// Types for function parameters
type CheckAndExecuteFunction = (callback: () => Promise<void>) => Promise<void>;
type SyncPendingConversationFunction = (conversationId: number, forceRefresh?: boolean) => Promise<unknown>;

export const handleMessage = async (
  message: MessageDTO, 
  userId: number | null, 
  currentConversationId: number | null, 
  showMessages: boolean,
  ensureConversationExists: (conversationId: number, shouldCache?: boolean) => Promise<void>
) => {
  console.log("💬 Mottatt melding via useChatHub:", message);

  const { addMessage, updateConversationTimestamp, conversations } = useChatStore.getState();

  await ensureConversationExists(message.conversationId, true);
  addMessage(message);
  updateConversationTimestamp(message.conversationId, message.sentAt);
  
  if (!message.isSilent && !message.isSystemMessage) {
    handleIncomingMessage(message, userId);
  }

  const conversation = conversations.find(c => c.id === message.conversationId);

  // Convert userId to number for comparison with message.senderId
  const userIdAsNumber = userId ?? null;

  if (
    message.senderId !== userIdAsNumber &&
    (!showMessages || message.conversationId !== currentConversationId) && 
    !message.isSilent &&
    !message.isSystemMessage
  ) {
    showNotificationToast({
      senderName: message.sender?.fullName ?? "ukjent",
      messagePreview: truncateText(message.text),
      senderProfileImage: message.sender?.profileImageUrl,
      conversationId: message.conversationId,
      type: NotificationType.NewMessage,
      attachments: message.attachments,
      groupName: conversation?.isGroup ? conversation?.groupName : null,
      groupImage: conversation?.isGroup ? conversation?.groupImageUrl : null,
    });
  }
};

export const handleReaction = async (
  reaction: ReactionDTO, 
  notification: MessageNotificationDTO | undefined, 
  userId: number | null
) => {
  console.log("🎉 Mottatt reaksjon via useChatHub:", reaction);

  const { updateMessageReactions, updateSearchResultReactions, searchMode } = useChatStore.getState();

  if (notification?.conversationId) {
    await preloadMessagesForConversation(notification.conversationId);
  }

  updateMessageReactions(reaction);
  handleIncomingReaction(reaction, userId, notification || undefined);

  if (searchMode) {
    updateSearchResultReactions(reaction);
  }
};

export const handleRequestApproved = async (notification: MessageNotificationDTO) => {
  console.log("✅ Godkjent forespørsel via useChatHub:", notification); 
  const convId = notification.conversationId;
  if (!convId) return;

  showNotificationToast({
    senderName: notification.senderName ?? "Someone",
    messagePreview: notification.messagePreview,
    conversationId: convId,
    type: NotificationType.MessageRequestApproved,
  });

  await finalizeConversationApproval(convId, true, notification);
};

export const handleRequestCreated = async (
  data: MessageRequestCreatedDto,
  userId: number | null,
  checkAndExecute: CheckAndExecuteFunction,
  syncPendingConversation: SyncPendingConversationFunction
) => {
  await checkAndExecute(async () => {
    if (data.notification) {
      await handleIncomingNotification(data.notification);
      await syncPendingConversation(data.conversationId);
      
      // Convert userId to number for comparison
      const userIdAsNumber = userId ?? null;
      
      if (data.notification.senderId !== userIdAsNumber) {
        showNotificationToast({
          senderName: data.notification.senderName,
          messagePreview: data.notification.messagePreview,
          type: NotificationType.MessageRequest,
          conversationId: data.conversationId,
        });
      }
    }
  });
};

export const handleMessageDeleted = async (data: { conversationId: number; message: MessageDTO }) => {
  console.log("🗑️ Mottatt slettet melding via useChatHub:", data);
  
  const { conversationId, message } = data;
  const { conversationIds, updateMessage } = useChatStore.getState();
  
  if (conversationIds.has(conversationId)) {
    console.log(`✅ Oppdaterer slettet melding ${message.id} i samtale ${conversationId}`);
    updateMessage(conversationId, message.id, message);
    console.log(`🔄 Melding ${message.id} oppdatert med isDeleted: ${message.isDeleted}`);
  } else {
    console.log(`⚠️ Samtale ${conversationId} finnes ikke i store, hopper over oppdatering`);
  }
};