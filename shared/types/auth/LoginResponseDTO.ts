import { UserSummaryDTO } from "../UserSummaryDTO";

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: string;
  refreshTokenExpires: string;
}

export interface LoginResponseDTO extends TokenResponse {
  user: UserSummaryDTO;
}
