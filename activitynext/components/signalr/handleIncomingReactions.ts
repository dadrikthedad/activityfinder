import { ReactionDTO } from "@/types/MessageDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { showNotificationToast } from "../toast/Toast";
import { NotificationType } from "@/types/MessageNotificationDTO";
import { handleIncomingReactionNotification } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { toast } from "sonner";

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
    // ✅ Ellers: bruk notificationen hvis vi fikk den fra backend
      } else if (notification) {
  const isNew = await handleIncomingReactionNotification(notification, { onlyIfNew: false });

    if (isNew) {
      showNotificationToast({
        senderName: notification.senderName,
        messagePreview: notification.messagePreview,
        conversationId: notification.conversationId!,
        type: NotificationType.MessageReaction,
        reactionEmoji: notification.reactionEmoji,
      });
    } else {

      showNotificationToast({
        senderName: notification.senderName,
        messagePreview: notification.messagePreview,
        conversationId: notification.conversationId!,
        type: NotificationType.MessageReaction,
        reactionEmoji: notification.reactionEmoji,
      });
        toast("🔄 Reaksjon oppdatert", {
          description: `${notification.senderName} changed his reaction to ${notification.reactionEmoji ?? ""} on message: ${notification.messagePreview ?? ""}`,
        });
      }

  if (!unreadConversationIds.includes(reaction.conversationId)) {
    setUnreadConversationIds([...unreadConversationIds, reaction.conversationId]);
  }
}

  // ♻️ Tving rerender for f.eks. reactions i MessageList
  bumpReactionsVersion();
}