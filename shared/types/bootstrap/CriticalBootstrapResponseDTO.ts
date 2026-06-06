import { UserBootstrapDTO } from "../UserBootstrapDTO";
import { UserProfileDTO } from "../UserProfileDTO";
import { UserSettingsDTO } from "../UserSettingsDTO";
import { BlockedUserDTO } from "../BlockedUserDTO";

export interface CriticalBootstrapResponseDTO {
  user: UserBootstrapDTO;
  profile: UserProfileDTO;
  settings: UserSettingsDTO;
  blockedUsers: BlockedUserDTO[];
}
