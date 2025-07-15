import { UserSummaryDTO } from "../UserSummaryDTO";
import { UserSettingsDTO } from "../UserSettingsDTO";
import { MessageRequestDTO } from "../MessageReqeustDTO";


export interface SecondaryBootstrapResponseDTO {
  settings: UserSettingsDTO;
  friends: UserSummaryDTO[];
  blockedUsers: UserSummaryDTO[];
  unreadConversationIds: number[];
  pendingMessageRequests: MessageRequestDTO[];
}