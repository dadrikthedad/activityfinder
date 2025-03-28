import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

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

export async function checkEmailAvailability(email: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/check-email?email=${email}`);
  
      // 👉 Håndter status før vi parser JSON
      if (!res.ok) {
        const text = await res.text(); // unngå JSON.parse-feil
        throw new Error(text || "Email check failed");
      }
  
      const data = await res.json();
      return !data.exists;
    } catch (error) {
      console.error("❌ Error checking email:", error);
      return false;
    }
  }

export async function registerUserAPI(payload: RegisterUserPayload): Promise<any> {
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

export async function getCurrentUser(token: string) {
  try {
    const user = await fetchWithAuth(`${API_BASE_URL}/api/user/me`, {}, token);
    return user;
  } catch (err: any) {
    console.error("❌ Failed to fetch current user:", err.message);
    throw err;
  }
}