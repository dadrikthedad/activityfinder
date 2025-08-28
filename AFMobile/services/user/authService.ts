// services/auth/authService.ts - Oppdatert til å bruke AuthService
import { postRequestPublic } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { LoginResponseDTO } from "@shared/types/auth/LoginResponseDTO";
import authServiceNative from "./authServiceNative";
import type { LoginErrorResponse } from "@shared/types/auth/LoginErrorResponseDTO";

// Types for auth
export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
}

export function isEmailVerificationRequired(response: LoginErrorResponse): boolean {
  return response.emailVerificationRequired === true;
}

// Helper function to check if login was successful
export function isLoginSuccessful(response: LoginResponseDTO): boolean {
  return !!response.accessToken;
}

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResponseDTO> {
  try {
    console.log("🟡 Attempting login for:", email);
    
    // Bruk den nye AuthService som håndterer alt automatisk
    const response = await authServiceNative.login(email, password);

    console.log("✅ Login successful");
    return response;
    
  } catch (error: any) {
    console.error("❌ Login error:", error);
    
    // Backend håndterer allerede email verification errors, så bare kast error videre
    throw error;
  }
}

// Logout user - Bruk AuthService
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

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  return await authServiceNative.isAuthenticated();
}

// Get current access token
export async function getAccessToken(): Promise<string | null> {
  return await authServiceNative.getAccessToken();
}

// Register user - Fortsatt bruk postRequestPublic siden det ikke krever auth
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  confirmPassword?: string
): Promise<LoginResponseDTO | null> {
  const registerPayload: RegisterPayload = {
    email,
    password,
    name,
    confirmPassword,
  };
  
  console.log("🟡 Registering user:", email);
  
  try {
    const response = await postRequestPublic<LoginResponseDTO, RegisterPayload>(
      `${API_BASE_URL}/api/user/register`, 
      registerPayload
    );
    
    if (response) {
      console.log("✅ Registration successful");
      // Hvis registrering returnerer tokens, lagre dem automatisk
      if (response.accessToken) {
        await authServiceNative.setTokensFromRegistration(response); 
        }
    }
    
    return response;
  } catch (error) {
    console.error("❌ Registration error:", error);
    throw error;
  }
}