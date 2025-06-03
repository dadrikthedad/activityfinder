export interface MessageNotificationDTO {
  id: number;
  type: NotificationType | keyof typeof NotificationType;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  messageId?: number | null;
  conversationId?: number | null;
  senderId?: number | null;    
  senderName?: string | null;
  groupName?: string | null;
  reactionEmoji?: string | null;
  messagePreview?: string | null;
  messageCount?: number | null;
}

export enum NotificationType {
  NewMessage = 0,
  MessageRequest = 1,
  MessageRequestApproved = 2,
  MessageReaction = 4
}
