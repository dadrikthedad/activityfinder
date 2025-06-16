// Interface til Conversations til å matche API-en fra backend
import { UserSummaryDTO } from "./UserSummaryDTO";
  
  export interface ConversationDTO {
    id: number;
    groupName?: string;
    isGroup: boolean;
    lastMessageSentAt?: string;
    participants: UserSummaryDTO[];
    isPendingApproval: boolean;
    isApproved?: boolean;
  }
  
  export interface PagedConversationsResponseDTO {
    totalCount: number;
    conversations: ConversationDTO[];
  }