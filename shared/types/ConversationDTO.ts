// Interface til Conversations til å matche API-en fra backend
import { UserSummaryDTO } from "./UserSummaryDTO";
  
export interface ConversationDTO {
  id: number;
  groupName?: string;
  isGroup: boolean;
  groupImageUrl?: string;
  lastMessageSentAt?: string;
  participants: ConversationParticipantDTO[];  
}

export interface ConversationParticipantDTO {
    user: UserSummaryDTO;  // Brukerinfo
    conversationStatus: ConversationStatus;  // Samtale-spesifikk status
    hasDeleted?: boolean;
}

export enum ConversationStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Creator = 3
}
  
  
export interface PagedConversationsResponseDTO {
  totalCount: number;
  conversations: ConversationDTO[];
}



