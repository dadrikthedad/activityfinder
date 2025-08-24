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
    // ipwhois.io - 10,000 gratis requests per måned, kommersielt bruk OK
    const locationRes = await fetch("https://ipwho.is/", {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!locationRes.ok) {
      throw new Error(`HTTP error! status: ${locationRes.status}`);
    }
    
    const locationData = await locationRes.json();
    
    // Sjekk om request var vellykket
    if (!locationData.success) {
      throw new Error('Location API returned unsuccessful response');
    }
   
    return {
      ip: locationData.ip || "",
      city: locationData.city || "",
      region: locationData.region || "", 
      country: locationData.country_code || "", // ISO 2-letter code
      country_name: locationData.country || "", // Full country name
    };
  } catch (error) {
    console.warn("Could not fetch location data from ipwhois.io, trying fallback:", error);
    
    // Fallback til FreeIPAPI.com (60/min, unlimited gratis)
    try {
      const fallbackRes = await fetch("https://freeipapi.com/api/json/");
      const fallbackData = await fallbackRes.json();
      
      return {
        ip: fallbackData.ipAddress || "",
        city: fallbackData.cityName || "",
        region: fallbackData.regionName || "",
        country: fallbackData.countryCode || "",
        country_name: fallbackData.countryName || "",
      };
    } catch (fallbackError) {
      console.warn("Fallback location service also failed:", fallbackError);
      return {};
    }
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

// Login user - ✅ Oppdatert til å bruke postRequestPublic med device headers
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
 
  try {
    console.log("🟡 Attempting login for:", email);
    
    // ✅ Bruk postRequestPublic som sender device headers automatisk
    const response = await postRequestPublic<LoginResponse, LoginPayload>(
      `${API_BASE_URL}/api/user/login`,
      loginPayload
    );

    if (!response) {
      throw new Error("Login failed - no response received");
    }

    console.log("✅ Login successful");
    return response;
    
  } catch (error: any) {
    console.error("❌ Login error:", error);
    
    // Hvis det er en 401 feil med email verification required
    if (error.message && error.message.includes("email verification")) {
      return {
        message: error.message,
        emailVerificationRequired: true,
        email: loginPayload.email
      } as LoginResponse;
    }
    
    throw error;
  }
}

// Resend verification email - ✅ Oppdatert til å bruke postRequestPublic
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log("🟡 Resending verification email to:", email);
    
    // ✅ Bruk postRequestPublic som sender device headers automatisk
    const response = await postRequestPublic<{ message: string }, { email: string }>(
      `${API_BASE_URL}/api/email/resend-verification`,
      { email }
    );

    if (response) {
      console.log("✅ Verification email sent successfully");
      return {
        success: true,
        message: response.message || "Email sent successfully"
      };
    } else {
      throw new Error("Failed to send email");
    }
    
  } catch (error: any) {
    console.error("❌ Resend verification email error:", error);
    return {
      success: false,
      message: error.message || "Network error. Please try again."
    };
  }
}

// Register user - ✅ Allerede bruker postRequestPublic
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
  
  console.log("🟡 Registering user:", email);
  
  try {
    const response = await postRequestPublic<LoginResponse, RegisterPayload>(
      `${API_BASE_URL}/api/user/register`, 
      registerPayload
    );
    
    if (response) {
      console.log("✅ Registration successful");
    }
    
    return response;
  } catch (error) {
    console.error("❌ Registration error:", error);
    throw error;
  }
}