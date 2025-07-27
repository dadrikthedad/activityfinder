import { UserSummaryDTO } from "../UserSummaryDTO";
import { UserSettingsDTO } from "../UserSettingsDTO";
import { MessageRequestDTO } from "../MessageReqeustDTO";
import { MessageNotificationDTO } from "../MessageNotificationDTO";
import { FriendInvitationDTO } from "../FriendInvitationDTO";
import { NotificationDTO } from "../NotificationEventDTO";


export interface SecondaryBootstrapResponseDTO {
  settings: UserSettingsDTO;
  allUserSummaries: UserSummaryDTO[];
  unreadConversationIds: number[];
  pendingMessageRequests: MessageRequestDTO[];
  recentMessageNotifications: MessageNotificationDTO[];
  pendingFriendInvitations: FriendInvitationDTO[];
  recentNotifications: NotificationDTO[];
}