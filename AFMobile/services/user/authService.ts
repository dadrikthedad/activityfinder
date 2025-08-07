import { postRequestPublic } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";

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

export interface LoginResponse {
  token: string;
  user?: {
    id: number;
    email: string;
    name?: string;
    // Add other user fields as needed
  };
  message?: string;
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

// Login user
export async function loginUser(
  email: string,
  password: string,
  includeLocation: boolean = true
): Promise<LoginResponse | null> {
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
  return await postRequestPublic<LoginResponse, LoginPayload>(url, loginPayload);
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