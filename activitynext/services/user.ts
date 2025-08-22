// API kall til backend for å hente fetchCountries(), fetchRegions(), regiserUserApi() som brukes i Signup og getCurrentUser() som brukes i Securitycred
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { User } from "@shared/types/UserDTO";
import { RegisterResponse } from "@shared/types/auth/RegisterResponseDTO";
import { RegisterUserPayload } from "@shared/types/auth/RegisterUserPayloadDTO";

const isServer = typeof window === "undefined";

export const API_BASE_URL = isServer
  ? process.env.API_URL_INTERNAL || "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net"
  : process.env.NEXT_PUBLIC_API_URL || "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";


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
// Henter land fra GetAllCountries() i backend som bruker countryservice.GetAllCountries()
export async function fetchCountries(): Promise<Country[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/countries`);
    if (!res.ok) throw new Error("Failed to fetch countries");
    return await res.json();
  } catch (error) {
    console.error("❌ Error fetching countries:", error);
    return [];
  }
}
// Henter regioner utifra landet vi har valgt, bruker GetRegionsByCountry() i backend
export async function fetchRegions(code: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/regions/${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error("Failed to fetch regions");
    return await res.json();
  } catch (error) {
    console.error("❌ Error fetching regions:", error);
    return [];
  }
}

// Registerer bruker i backend med RegisterUser(), brukt i Signup
export async function registerUserAPI(payload: RegisterUserPayload): Promise<RegisterResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      // Handle different types of errors
      if (data.errors) {
        // Validation errors - format them nicely
        const errorMessages = Object.entries(data.errors as Record<string, string[]>)
          .map(([field, messages]) => 
            `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
          )
          .join('\n');
        throw new Error(errorMessages);
      } else {
        // Single error message
        throw new Error(data.message || "User registration failed");
      }
    }
    
    return data as RegisterResponse;
  } catch (error) {
    console.error("❌ Error registering user:", error);
    throw error;
  }
}

// Helper function to check if email verification is required
export function requiresEmailVerification(response: RegisterResponse): boolean {
  return response.emailConfirmationRequired === true;
}


// Henter brukeren vi er på, brukes i securitycred for endringer av passord og epost. Henter GetCurrentUser() fra backend
export async function getCurrentUser(token: string): Promise<User> {
  try {
    const user = await fetchWithAuth<User>(`${API_BASE_URL}/api/user/me`, {}, token);

    if (!user) {
      throw new Error("No user returned from server.");
    }

    return user;
  } catch (err) {
    if (err instanceof Error) {
      console.error("❌ Failed to fetch current user:", err.message);
      throw err;
    } else {
      throw new Error("Unknown error occurred when fetching user.");
    }
  }
}