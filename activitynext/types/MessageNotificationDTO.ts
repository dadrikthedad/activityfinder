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
  groupImageUrl?: string;
  reactionEmoji?: string | null;
  messagePreview?: string | null;
  messageCount?: number | null;
  isTemporary?: boolean;
  isConversationRejected?: boolean;
  isReactionUpdate?: boolean;
  senderProfileImageUrl?: string | null;
}

export enum NotificationType {
  NewMessage = 1,
  MessageRequest = 2,
  MessageRequestApproved = 3,
  MessageReaction = 4,
  GroupRequest = 5,
  GroupRequestApproved = 6,
}
