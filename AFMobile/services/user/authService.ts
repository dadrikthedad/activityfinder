import { postRequestPublic } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";
import { LoginResponse } from "@shared/types/auth/LoginResponseDTO";

// Types for auth
export interface LoginPayload {
  email: string;
  password: string;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
}

export interface LocationData {
  ip: string;
  city: string;
  region: string;
  country: string;
  country_name: string;
}

// Get user location data for React Native
export async function getLocationData(): Promise<Partial<LocationData>> {
  try {
    const locationRes = await fetch("https://ipapi.co/json/");
    const locationData = await locationRes.json();
   
    return {
      ip: locationData.ip || "",
      city: locationData.city || "",
      region: locationData.region || "",
      country: locationData.country || "",
      country_name: locationData.country_name || "",
    };
  } catch (error) {
    console.warn("Could not fetch location data:", error);
    return {};
  }
}

// Helper function to check if login was successful
export function isLoginSuccessful(response: LoginResponse): boolean {
  return !!response.token;
}

// Helper function to check if email verification is required
export function isEmailVerificationRequired(response: LoginResponse): boolean {
  return response.emailVerificationRequired === true;
}

// Login user
export async function loginUser(
  email: string,
  password: string,
  includeLocation: boolean = true
): Promise<LoginResponse> {
  const loginPayload: LoginPayload = {
    email,
    password,
  };
 
  // Add location data if requested
  if (includeLocation) {
    const locationData = await getLocationData();
    Object.assign(loginPayload, locationData);
  }
 
  const url = `${API_BASE_URL}/api/user/login`;
 
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      // *** HÅNDTER EMAIL VERIFICATION REQUIRED ***
      if (response.status === 401 && data.emailVerificationRequired) {
        return {
          message: data.message,
          emailVerificationRequired: true,
          email: data.email
        } as LoginResponse;
      } else {
        // Andre login-feil
        throw new Error(data.message || "Login failed");
      }
    }

    return data as LoginResponse;
  } catch (error) {
    console.error("❌ Login API error:", error);
    throw error;
  }
}

// Resend verification email
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/email/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      message: data.message || (response.ok ? "Email sent successfully" : "Failed to send email")
    };
  } catch (error) {
    console.error("❌ Resend verification email error:", error);
    return {
      success: false,
      message: "Network error. Please try again."
    };
  }
}

// Register user (kan legges til senere)
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  confirmPassword?: string,
  includeLocation: boolean = true
): Promise<LoginResponse | null> {
  const registerPayload: RegisterPayload = {
    email,
    password,
    name,
    confirmPassword,
  };
  
  if (includeLocation) {
    const locationData = await getLocationData();
    Object.assign(registerPayload, locationData);
  }
  
  const url = `${API_BASE_URL}/api/user/register`;
  return await postRequestPublic<LoginResponse, RegisterPayload>(url, registerPayload);
}