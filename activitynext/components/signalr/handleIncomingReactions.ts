import { ReactionDTO } from "@/types/MessageDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { showNotificationToast } from "../toast/Toast";
import { NotificationType } from "@/types/MessageNotificationDTO";
import { handleIncomingReactionNotification } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { LocalToastType } from "../toast/Toast";

/**
 * Håndter innkommende reaksjon – oppdater lokal state for notification og reactions.
 * @param reaction Reaksjonen som ble sendt via SignalR
 * @param currentUserId Innlogget bruker
 * @param notification Notifikasjonen sendt fra backend (valgfri)
 */
export async function handleIncomingReaction(
  reaction: ReactionDTO,
  currentUserId: number | null,
  notification?: MessageNotificationDTO
) {
  const {
    currentConversationId,
    isAtBottom,
    markConversationAsReadLocally,
    unreadConversationIds,
    setUnreadConversationIds,
    bumpReactionsVersion,
  } = useChatStore.getState();

  // 👤 Ikke håndter egne reaksjoner
  if (reaction.userId === currentUserId) return;

  const isInActiveConversation = reaction.conversationId === currentConversationId;  

  // ✅ Hvis vi er i samtalen og i bunn – marker som lest direkte (lokalt)
  if (isInActiveConversation && isAtBottom) {
    markConversationAsReadLocally(reaction.conversationId);
  } 
  // ✅ Ellers: bruk notificationen hvis vi fikk den fra backend
  else if (notification) {
    // Oppdater notification store
    await handleIncomingReactionNotification(notification, { onlyIfNew: false });

    // ✅ Bruk backend-informasjonen for å bestemme toast-type
    showNotificationToast({
      senderName: notification.senderName,
      messagePreview: notification.messagePreview,
      conversationId: notification.conversationId!,
      type: notification.isReactionUpdate 
        ? LocalToastType.MessageReactionChanged 
        : NotificationType.MessageReaction,
      reactionEmoji: notification.reactionEmoji,
      messageId: notification.messageId,
    });

    // Marker samtale som ulest hvis ikke allerede markert
    if (!unreadConversationIds.includes(reaction.conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, reaction.conversationId]);
    }
  }

  // ♻️ Tving rerender for f.eks. reactions i MessageList
  bumpReactionsVersion();
}