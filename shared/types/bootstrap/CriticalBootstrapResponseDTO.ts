import { UserSummaryDTO } from "../UserSummaryDTO";
import { UserSettingsDTO } from "../UserSettingsDTO";

export interface CriticalBootstrapResponseDTO {
  user: UserSummaryDTO;
  settings: UserSettingsDTO;
  syncToken: string;
}