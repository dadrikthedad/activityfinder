// core/models/TokenResponse.ts
// Delt DTO for token-respons fra auth-endepunkter.
// Tilsvarer TokenResponse i AFBack.
// Brukes av LoginResponseDTO og potensielt refresh-token-respons.

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: string;
  refreshTokenExpires: string;
}
