import { MessageDTO } from "@/types/MessageDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";

/**
 * Håndter innkommende melding i frontend – oppdater notifications og unread-status
 * @param message Meldingen som kom inn via SignalR
 * @param currentUserId ID-en til brukeren som er logget inn
 */
export function handleIncomingMessage(message: MessageDTO, currentUserId: number | null) {
  const {
    addMessageNotification,
    messageNotifications,
    unreadConversationIds,
    currentConversationId,
    isAtBottom,
    setUnreadConversationIds,
  } = useChatStore.getState();

  // Ikke lag notification for egne meldinger
  if (message.senderId === currentUserId) return;

  // 👉 Ikke lag notification hvis vi er i samtalen og den er aktivt åpen
    if (message.conversationId === currentConversationId && isAtBottom) {
    return;
  }

  // Unngå duplikate notifications
  const alreadyExists = messageNotifications.some(
    (n) => n.conversationId === message.conversationId &&
           n.senderId === message.senderId &&
           n.createdAt === message.sentAt
  );

  if (!alreadyExists) {
    const fakeNotification: MessageNotificationDTO = {
      id: Date.now(), // midlertidig lokal ID
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender?.fullName ?? "Unknown",
      type: "NewMessage",
      isRead: false,
      createdAt: message.sentAt,
      reactionEmoji: null,
      messagePreview: message.text?.slice(0, 40) ?? "",
    };

    addMessageNotification(fakeNotification);
  }

  // Oppdater unread-conversationId-listen hvis vi ikke er i samtalen
    if (message.conversationId !== currentConversationId || !isAtBottom) {
    if (!unreadConversationIds.includes(message.conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, message.conversationId]);
    }
  }
}
