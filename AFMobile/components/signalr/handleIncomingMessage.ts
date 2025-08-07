import { MessageDTO } from "@shared/types/MessageDTO";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";
import { handleIncomingNotification } from "@/utils/messages/getNotificationsBeforeSignalr";

/**
 * Håndter innkommende melding i frontend – oppdater notifications og unread-status
 * @param message Meldingen som kom inn via SignalR
 * @param currentUserId ID-en til brukeren som er logget inn
 */
export async function handleIncomingMessage(message: MessageDTO, currentUserId: number | null) {
  const {
    unreadConversationIds,
    currentConversationId,
    isAtBottom,
    setUnreadConversationIds,
    conversations,
  } = useChatStore.getState();
  
  // Ikke lag notification for egne meldinger
  if (message.senderId === currentUserId) return;
  
  // 👉 Ikke lag notification hvis vi er i samtalen og den er aktivt åpen
  if (message.conversationId === currentConversationId && isAtBottom) {
    return;
  }

  // Finn conversation for å sjekke om det er en gruppe
  const conversation = conversations.find(c => c.id === message.conversationId);
  const isGroup = conversation?.isGroup ?? false;

  // Generer riktig messagePreview basert på type
  const getTruncatedText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.length > 40 ? text.substring(0, 40) + "..." : text;
  };

  // Generer riktig messagePreview basert på type
  let messagePreview: string;
  if (isGroup) {
    const groupName = conversation?.groupName ?? "a group";
    const msgText = getTruncatedText(message.text);
    messagePreview = `sent to ${groupName}: ${msgText}`;
  } else {
    const msgText = getTruncatedText(message.text);
    messagePreview = `said: ${msgText}`;
  }
  

  // Lag ny notification eller oppdater eksisterende
  const newNotif: MessageNotificationDTO = {
    id: Date.now(), // midlertidig ID
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: message.sender?.fullName ?? "Unknown",
    senderProfileImageUrl: message.sender?.profileImageUrl,
    groupName: isGroup ? conversation?.groupName : undefined,
    groupImageUrl: isGroup ? conversation?.groupImageUrl : undefined,
    type: "NewMessage",
    isRead: false,
    createdAt: message.sentAt,
    reactionEmoji: null,
    messagePreview: messagePreview, // Riktig formatert preview
    messageCount: 1,
    isTemporary: true,
  };

  await handleIncomingNotification(newNotif);
  
  // Oppdater unread-conversationId-listen hvis vi ikke er i samtalen
  if (message.conversationId !== currentConversationId || !isAtBottom) {
    if (!unreadConversationIds.includes(message.conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, message.conversationId]);
    }
  }
}