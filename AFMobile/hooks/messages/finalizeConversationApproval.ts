import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { getConversationById } from "@/services/messages/conversationService";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { handleIncomingNotification } from "@/utils/messages/getNotificationsBeforeSignalr";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";

export async function finalizeConversationApproval(
  conversationId: number,
  shouldHandleNotification = false,
  notification?: MessageNotificationDTO
) {
  const {
    setCachedMessages,
    setCurrentConversationId,
    setPendingLockedConversationId,
    currentConversationId,
  } = useChatStore.getState();

  const {
    removePendingConversation,
    addConversation,
    unreadConversationIds,
    setUnreadConversationIds,
  } = useConversationStore.getState();

  const conv = await getConversationById(conversationId);
  if (!conv) return;

  const unlockedConversation = { ...conv, isPendingApproval: false };
  addConversation(unlockedConversation);

  const messages = await getMessagesForConversation(conversationId, 0, 20);
  setCachedMessages(conversationId, messages ?? []);

  removePendingConversation(conversationId);
  setPendingLockedConversationId(null);

  if (currentConversationId === conversationId) {
    setCurrentConversationId(conversationId);
    useMessageNotificationStore.getState().markAsReadForConversation(conversationId);
  } else {
    if (!unreadConversationIds.includes(conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, conversationId]);
    }
  }

  if (shouldHandleNotification && notification) {
    await handleIncomingNotification(notification);
  }
}
