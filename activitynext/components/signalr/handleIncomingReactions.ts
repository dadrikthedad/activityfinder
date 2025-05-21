import { ReactionDTO } from "@/types/MessageDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { showNotificationToast } from "../toast/Toast";
import { NotificationType } from "@/types/MessageNotificationDTO";
import { toast } from "sonner";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

/**
 * Håndter innkommende reaksjon – oppdater lokal state for notification og reactions.
 * @param reaction Reaksjonen som ble sendt via SignalR
 * @param currentUserId Innlogget bruker
 * @param notification Notifikasjonen sendt fra backend (valgfri)
 */
export function handleIncomingReaction(
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
     const { upsertNotification } = useMessageNotificationStore.getState();
    const isNew = upsertNotification(notification);


      if (isNew) {
        showNotificationToast({
          senderName: notification.senderName,
          messagePreview: `Reagerte på meldingen din`,
          conversationId: notification.conversationId!,
          type: NotificationType[notification.type as keyof typeof NotificationType],
          reactionEmoji: notification.reactionEmoji,
        });
      } else {
        toast("🔄 Reaksjon oppdatert", {
          description: `${notification.senderName} endret sin reaksjon`,
        });
      }

    // 🔔 Oppdater samtalelisten hvis ikke allerede markert
    if (!unreadConversationIds.includes(reaction.conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, reaction.conversationId]);
    }
  }

  // ♻️ Tving rerender for f.eks. reactions i MessageList
  bumpReactionsVersion();
}