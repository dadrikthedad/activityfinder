import { UserSummaryDTO } from "../UserSummaryDTO";
import { UserSettingsDTO } from "../UserSettingsDTO";

export interface SecondaryBootstrapResponseDTO {
  settings: UserSettingsDTO;
  friends: UserSummaryDTO[];
  blockedUsers: UserSummaryDTO[];
}