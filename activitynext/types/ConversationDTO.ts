// Interface til Conversations til å matche API-en fra backend
import { UserSummaryDTO } from "./UserSummaryDTO";
  
  export interface ConversationDTO {
    id: number;
    groupName?: string;
    isGroup: boolean;
    groupImageUrl?: string;
    lastMessageSentAt?: string;
    creatorId?: number;
    participants: UserSummaryDTO[];
    isPendingApproval: boolean;
    isApproved?: boolean;
    disbanded?: boolean;
    disbandedAt?: string;
  }
  
  export interface PagedConversationsResponseDTO {
    totalCount: number;
    conversations: ConversationDTO[];
  }