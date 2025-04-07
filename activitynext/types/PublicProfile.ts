// Henter infromasjon fra user.ts, profile.ts og settings.ts for å kunne vise profil til bruker og andre

import { User } from "./user";
import { Profile } from "./profile";
import { UserSettingsDTO } from "./settings";

export interface PublicProfileDTO extends Partial<User>, Partial<Profile>, Partial<UserSettingsDTO> {
  userId: number;
  isOwner: boolean;
}
