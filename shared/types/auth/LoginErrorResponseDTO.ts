import { LoginResponseDTO } from "./LoginResponseDTO";
export type LoginResult = LoginResponseDTO | LoginErrorResponse;

export interface LoginErrorResponse {
  message: string;
  emailVerificationRequired?: boolean;
  email?: string;
}