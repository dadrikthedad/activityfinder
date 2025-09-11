import { UserSummaryDTO } from "../UserSummaryDTO";
import { ConversationDTO } from "../ConversationDTO";
import { EncryptedMessageDTO } from "@/components/ende-til-ende/EncryptedMessageDto";
import { MessageRequestDTO } from "../MessageReqeustDTO";
import { MessageNotificationDTO } from "../MessageNotificationDTO";
import { FriendInvitationDTO } from "../FriendInvitationDTO";
import { NotificationDTO } from "../NotificationEventDTO";

export interface SecondaryBootstrapResponseDTO {
  // Moved from Critical Bootstrap
  recentConversations: ConversationDTO[];
  // Key = conversationId, Value = array of messages
  conversationMessages: Record<number, EncryptedMessageDTO[]>;
  
  // Existing secondary data
  allUserSummaries: UserSummaryDTO[];
  unreadConversationIds: number[];
  pendingMessageRequests: MessageRequestDTO[];
  recentMessageNotifications: MessageNotificationDTO[];
  pendingFriendInvitations: FriendInvitationDTO[];
  recentNotifications: NotificationDTO[];
}