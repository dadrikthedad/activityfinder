import { API_BASE_URL } from "@/constants/routes";
import { RegisterResponse } from "@shared/types/auth/RegisterResponseDTO";
import { RegisterUserPayload } from "@shared/types/auth/RegisterUserPayloadDTO";
import { getRequestPublic, postRequestPublic } from "@/services/baseService";

// Check email availability - ✅ Oppdatert til getRequestPublic med device headers
export async function checkEmailAvailability(email: string): Promise<boolean> {
  try {
    console.log("🟡 Checking email availability for:", email);
    
    const normalized = email.trim().toLowerCase();
    
    // ✅ Bruk getRequestPublic som sender device headers automatisk
    const data = await getRequestPublic<{ exists: boolean }>(
      `${API_BASE_URL}/api/user/check-email?email=${encodeURIComponent(normalized)}`
    );

    if (!data) {
      console.warn("⚠️ No response from email check API");
      return false; // Ved feil, returner false (ikke tilgjengelig) for sikkerhet
    }

    console.log("✅ Email check result:", { email: normalized, exists: data.exists, available: !data.exists });
    
    return !data.exists; // true = tilgjengelig, false = opptatt
  } catch (error) {
    console.error("❌ Error checking email availability:", error);
    // Ved feil, returner false (ikke tilgjengelig) for sikkerhet
    return false;
  }
}

// Type for land
export interface Country {
  code: string;
  name: string;
}

// Type for select-option
export interface SelectOption {
  label: string;
  value: string;
}

// Henter land - ✅ Oppdatert til getRequestPublic med device headers
export async function fetchCountries(): Promise<Country[]> {
  try {
    console.log("🟡 Fetching countries from:", `${API_BASE_URL}/api/user/countries`);
    
    // ✅ Bruk getRequestPublic som sender device headers automatisk
    const data = await getRequestPublic<Country[]>(`${API_BASE_URL}/api/user/countries`);

    if (!data) {
      console.warn("⚠️ No response from countries API");
      return [];
    }

    console.log("✅ Countries fetched successfully:", data.length, "countries");
    return data;
  } catch (error) {
    console.error("❌ Error fetching countries:", error);
    return [];
  }
}

// Henter regioner - ✅ Oppdatert til getRequestPublic med device headers
export async function fetchRegions(code: string): Promise<string[]> {
  try {
    console.log("🟡 Fetching regions for country:", code);
    
    // ✅ Bruk getRequestPublic som sender device headers automatisk
    const data = await getRequestPublic<string[]>(
      `${API_BASE_URL}/api/user/regions/${encodeURIComponent(code)}`
    );

    if (!data) {
      console.warn("⚠️ No response from regions API");
      return [];
    }

    console.log("✅ Regions fetched successfully:", data.length, "regions");
    return data;
  } catch (error) {
    console.error("❌ Error fetching regions:", error);
    return [];
  }
}

// Registerer bruker - ✅ Oppdatert til postRequestPublic med device headers
export async function registerUserAPI(payload: RegisterUserPayload): Promise<RegisterResponse> {
  try {
    console.log("🟡 Registering user:", payload.email);
   
    // ✅ Bruk postRequestPublic som sender device headers automatisk
    const data = await postRequestPublic<RegisterResponse, RegisterUserPayload>(
      `${API_BASE_URL}/api/user/register`,
      payload
    );

    if (!data) {
      throw new Error("Registration failed - no response received");
    }
    
    console.log("✅ User registered successfully");
    return data;
  } catch (error: any) {
    console.error("❌ Error registering user:", error);
    
    // Handle different types of errors (samme som web-versjonen)
    if (error.message && error.message.includes("errors")) {
      // Try to parse validation errors from error message
      throw new Error(error.message);
    } else {
      // Single error message
      throw new Error(error.message || "User registration failed");
    }
  }
}