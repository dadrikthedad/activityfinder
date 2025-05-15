export interface MessageRequestDTO {
  senderId: number;
  senderName: string;
  profileImageUrl?: string;
  requestedAt: string;

  conversationId?: number;
  groupName?: string;
  isGroup: boolean;

  limitReached: boolean;
  isPendingApproval: boolean;
}
