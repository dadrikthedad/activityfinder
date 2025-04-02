import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { User } from "@/types/user";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";


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

export async function registerUserAPI(payload: RegisterUserPayload): Promise<RegisterResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "User registration failed");

    return data;
  } catch (error) {
    console.error("❌ Error registering user:", error);
    throw error;
  }
}

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