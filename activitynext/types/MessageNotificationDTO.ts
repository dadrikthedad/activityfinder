export interface MessageNotificationDTO {
  id: number;
  type: "NewMessage" | "MessageRequest" | "MessageRequestApproved" | "MessageReaction";
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
}
