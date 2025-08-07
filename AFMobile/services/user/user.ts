// API kall til backend for å hente fetchCountries(), fetchRegions(), regiserUserApi() som brukes i Signup og getCurrentUser() som brukes i Securitycred
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { API_BASE_URL } from "@/constants/routes";
import { User } from "@shared/types/UserDTO";

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

// Type for registrering
export interface RegisterUserPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  dateOfBirth: string;
  country: string;
  region?: string;
  postalCode?: string;
  gender: string;
}

interface RegisterResponse {
  message: string;
  userId?: string;
}

// Henter land - bruker fetchWithAuth uten token (offentlig endpoint)
export async function fetchCountries(): Promise<Country[]> {
  try {
    const data = await fetchWithAuth<Country[]>(`${API_BASE_URL}/api/user/countries`);
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching countries:", error);
    return [];
  }
}

// Henter regioner - bruker fetchWithAuth uten token (offentlig endpoint)
export async function fetchRegions(code: string): Promise<string[]> {
  try {
    const data = await fetchWithAuth<string[]>(`${API_BASE_URL}/api/user/regions/${encodeURIComponent(code)}`);
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching regions:", error);
    return [];
  }
}

// Registerer bruker - bruker fetchWithAuth uten token (offentlig endpoint)
export async function registerUserAPI(payload: RegisterUserPayload): Promise<RegisterResponse> {
  try {
    const data = await fetchWithAuth<RegisterResponse>(`${API_BASE_URL}/api/user/register`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    if (!data) {
      throw new Error("User registration failed");
    }
    
    return data;
  } catch (error) {
    console.error("❌ Error registering user:", error);
    throw error;
  }
}

// Henter current user - bruker fetchWithAuth med token
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