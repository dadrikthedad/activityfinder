import { ApiRoutes } from "@/constants/routes";
import { RegisterResponseDTO } from "@shared/types/auth/RegisterResponseDTO";
import { RegisterUserPayloadDTO } from "@shared/types/auth/RegisterUserPayloadDTO";
import { getRequestPublic, postRequestPublic } from "@/services/baseService";

// Henter land
export interface Country {
  code: string;
  name: string;
}

export async function fetchCountries(): Promise<Country[]> {
  try {
    const data = await getRequestPublic<Country[]>(ApiRoutes.geography.countries);
    return data ?? [];
  } catch (error) {
    console.error("❌ Error fetching countries:", error);
    return [];
  }
}

// Henter regioner for et land
export async function fetchRegions(countryCode: string): Promise<string[]> {
  try {
    const data = await getRequestPublic<string[]>(ApiRoutes.geography.regions(countryCode));
    return data ?? [];
  } catch (error) {
    console.error("❌ Error fetching regions:", error);
    return [];
  }
}

// Registrerer bruker
export async function registerUserAPI(payload: RegisterUserPayloadDTO): Promise<RegisterResponseDTO> {
  try {
    console.log("🟡 Registering user:", payload.email);

    const data = await postRequestPublic<RegisterResponseDTO, RegisterUserPayloadDTO>(
      ApiRoutes.auth.signup,
      payload
    );

    if (!data) throw new Error("Registration failed - no response received");

    console.log("✅ User registered successfully");
    return data;
  } catch (error: any) {
    console.error("❌ Error registering user:", error);
    throw new Error(error.message || "User registration failed");
  }
}
