import { ConversationDTO } from "../ConversationDTO";
import { EncryptedMessageDTO } from "@/features/crypto/types/EncryptedMessageTypes";
import { MessageNotificationDTO } from "../MessageNotificationDTO";

export interface SecondaryBootstrapResponseDTO {
  activeConversations: ConversationDTO[];
  pendingConversations: ConversationDTO[];
  conversationMessages: Record<number, EncryptedMessageDTO[]>;
  messageNotifications: MessageNotificationDTO[];
  unreadMessageNotificationCount: number;
  unreadConversationIds: number[];
}
