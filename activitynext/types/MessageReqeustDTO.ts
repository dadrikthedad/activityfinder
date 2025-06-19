import { UserSummaryDTO } from "./UserSummaryDTO";

export interface MessageRequestDTO {
  senderId: number;
  senderName: string;
  profileImageUrl?: string;
  requestedAt: string;

  conversationId?: number;
  groupName?: string;
  isGroup: boolean;
  groupImageUrl?: string;

  limitReached: boolean;
  isPendingApproval: boolean;
  participants?: UserSummaryDTO[];
}
