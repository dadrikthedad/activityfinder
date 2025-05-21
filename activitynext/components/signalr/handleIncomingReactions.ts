import { ReactionDTO } from "@/types/MessageDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";

export function handleIncomingReaction(reaction: ReactionDTO, currentUserId: number | null) {
  const {
    currentConversationId,
    isAtBottom,
    addMessageNotification,
    messageNotifications,
    unreadConversationIds,
    setUnreadConversationIds,
  } = useChatStore.getState();

  if (reaction.userId === currentUserId) return;

  const alreadyExists = messageNotifications.some(
    (n) =>
      n.type === "MessageReaction" &&
      n.reactionEmoji === reaction.emoji &&
      n.messageId === reaction.messageId &&
      n.senderId === reaction.userId
  );

  // Ikke vis notification hvis vi er i riktig samtale og scrollet i bunnen
  if (reaction.conversationId === currentConversationId && isAtBottom) return;

  if (!alreadyExists) {
    const notification: MessageNotificationDTO = {
      id: Date.now(), // fake ID
      type: "MessageReaction",
      isRead: false,
      createdAt: new Date().toISOString(),
      conversationId: reaction.conversationId,
      messageId: reaction.messageId,
      senderId: reaction.userId,
      senderName: reaction.userFullName ?? "Unknown",
      reactionEmoji: reaction.emoji,
    };

    addMessageNotification(notification);
  }

  // Unread-oppdatering
  if (
    reaction.conversationId !== currentConversationId &&
    !unreadConversationIds.includes(reaction.conversationId)
  ) {
    setUnreadConversationIds([...unreadConversationIds, reaction.conversationId]);
  }
}