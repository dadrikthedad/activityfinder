import { UserSummaryDTO } from "../UserSummaryDTO";
import { ConversationDTO } from "../ConversationDTO";
import { MessageDTO } from "../MessageDTO";

export interface CriticalBootstrapResponseDTO {
  user: UserSummaryDTO;
  recentConversations: ConversationDTO[];
  // Key = conversationId, Value = array of messages
  conversationMessages: Record<number, MessageDTO[]>;
  syncToken: string;
}