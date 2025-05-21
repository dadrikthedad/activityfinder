import { ReactionDTO } from "@/types/MessageDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";

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
    replaceReactionNotification,
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
  } else if (notification) {
    // ✅ Ellers: bruk notificationen hvis vi fikk den fra backend
    replaceReactionNotification(notification);

    // 🔔 Oppdater samtalelisten hvis ikke allerede markert
    if (!unreadConversationIds.includes(reaction.conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, reaction.conversationId]);
    }
  }

  // ♻️ Tving rerender for f.eks. reactions i MessageList
  bumpReactionsVersion();
}