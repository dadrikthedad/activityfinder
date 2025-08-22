export interface LoginResponse {
  token?: string;
  message: string;
  emailVerificationRequired?: boolean;
  email?: string;
}
