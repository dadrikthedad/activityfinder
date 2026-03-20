// services/user/authService.ts
import { LoginResponseDTO } from "@shared/types/auth/LoginResponseDTO";
import authServiceNative from "./authServiceNative";
import type { LoginErrorResponse } from "@shared/types/auth/LoginErrorResponseDTO";

export function isEmailVerificationRequired(response: LoginErrorResponse): boolean {
  return response.emailVerificationRequired === true;
}

export function isLoginSuccessful(response: LoginResponseDTO): boolean {
  return !!response.accessToken;
}

export async function loginUser(email: string, password: string): Promise<LoginResponseDTO> {
  try {
    console.log("🟡 Attempting login for:", email);
    const response = await authServiceNative.login(email, password);
    console.log("✅ Login successful");
    return response;
  } catch (error) {
    console.error("❌ Login error:", error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    console.log("🟡 Logging out user");
    await authServiceNative.logout();
    console.log("✅ Logout successful");
  } catch (error) {
    console.error("❌ Logout error:", error);
    throw error;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return await authServiceNative.isAuthenticated();
}

export async function getAccessToken(): Promise<string | null> {
  return await authServiceNative.getAccessToken();
}
