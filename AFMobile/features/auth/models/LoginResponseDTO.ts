// features/auth/models/LoginResponseDTO.ts
// Tilsvarer LoginResponse i AFBack
import { TokenResponse } from "@/core/models/TokenResponse";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

export interface LoginResponseDTO extends TokenResponse {
  user: UserSummaryDTO;
}
