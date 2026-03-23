// features/auth/models/RefreshTokenRequestDTO.ts
// Tilsvarer RefreshTokenRequest i AFBack
export interface RefreshTokenRequest {
  refreshToken: string;
  deviceFingerprint: string;
}
