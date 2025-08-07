export interface SendGroupRequestsDTO {
  conversationId?: number; // Null for new group
  groupName?: string; // Required for new groups, max 100 chars
  groupImageUrl?: string; // Max 512 chars
  invitedUserIds: number[]; // Required
  initialMessage?: string; // Optional
}

export interface SendGroupRequestsResponseDTO {
  conversationId: number;
  isNewConversation: boolean;
  invitationsSent: number;
  totalRequestedUsers: number;
}