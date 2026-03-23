// features/auth/models/RegisterResponseDTO.ts
// Tilsvarer SignupResponse i AFBack
export interface RegisterResponseDTO {
  userId: string;    // string i backend (IdentityUser.Id)
  emailSent: boolean;
}
