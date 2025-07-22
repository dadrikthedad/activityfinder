import { UserSummaryDTO } from "../UserSummaryDTO";
import { UserSettingsDTO } from "../UserSettingsDTO";
import { MessageRequestDTO } from "../MessageReqeustDTO";
import { MessageNotificationDTO } from "../MessageNotificationDTO";


export interface SecondaryBootstrapResponseDTO {
  settings: UserSettingsDTO;
  friends: UserSummaryDTO[];
  blockedUsers: UserSummaryDTO[];
  unreadConversationIds: number[];
  pendingMessageRequests: MessageRequestDTO[];
  recentNotifications: MessageNotificationDTO[];
}