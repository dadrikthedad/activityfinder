import { UserSummaryDTO } from "../UserSummaryDTO";
import { ConversationDTO } from "../ConversationDTO";

export interface CriticalBootstrapResponseDTO {
  user: UserSummaryDTO;
  recentConversations: ConversationDTO[];
  syncToken: string;
}