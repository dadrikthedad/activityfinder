import { UserSummaryDTO } from "./UserSummaryDTO";

export enum ConversationType {
  DirectChat = 0,
  GroupChat = 1,
  PendingRequest = 2,
}

export enum ParticipantRole {
  PendingSender = 0,
  PendingRecipient = 1,
  Member = 2,
  Creator = 3,
}

export enum ConversationStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Creator = 3,
}

export interface ConversationDTO {
  id: number;
  type: ConversationType;
  groupName?: string;
  groupImageUrl?: string;
  lastMessageSentAt?: string;
  participants: ConversationParticipantDTO[];
}

export interface ConversationParticipantDTO {
  user: UserSummaryDTO;
  status: ConversationStatus;
  role: ParticipantRole;
  pendingMessagesReceived?: number | null;
  invitedAt?: string | null;
  joinedAt?: string | null;
}

export interface PagedConversationsResponseDTO {
  totalCount: number;
  conversations: ConversationDTO[];
}
