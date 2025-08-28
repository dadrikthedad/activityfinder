export interface LoginResponseDTO {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: string;
  refreshTokenExpires: string;
  message?: string;
  emailVerificationRequired?: boolean;
  email?: string;
}