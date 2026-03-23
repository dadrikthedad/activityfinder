// features/auth/services/signUpService.ts
import { ApiRoutes } from "@/core/api/routes";
import { RegisterResponseDTO } from "@/features/auth/models/RegisterResponseDTO";
import { RegisterUserPayloadDTO } from "@/features/auth/models/RegisterUserPayloadDTO";
import { getRequestPublic, postRequestPublic } from "@/core/api/baseService";
import { Result } from "@/core/errors/Result";
import { RegistrationErrorCode } from "@/core/errors/ErrorCode";
import { RateLimitError } from "@shared/types/security/RateLimitError";

/**
 * DTO for et land returnert fra geography-endepunktet.
 * Tilsvarer CountryDto i AFBack.
 */
export interface Country {
  code: string;
  name: string;
}

/**
 * Henter alle tilgjengelige land fra geography-endepunktet.
 * Returnerer tom liste ved feil (ikke-kritisk — UI viser tom dropdown).
 * @returns Liste med land med code og name
 */
export async function fetchCountries(): Promise<Country[]> {
  try {
    const data = await getRequestPublic<Country[]>(ApiRoutes.geography.countries);
    return data ?? [];
  } catch (error) {
    console.error("❌ Error fetching countries:", error);
    return [];
  }
}

/**
 * Henter tilgjengelige regioner for et gitt land.
 * Returnerer tom liste ved feil (ikke-kritisk — UI viser ingen region-dropdown).
 * @param countryCode - ISO 3166-1 alpha-2 landkode (f.eks. "NO", "US")
 * @returns Liste med regionnavn
 */
export async function fetchRegions(countryCode: string): Promise<string[]> {
  try {
    const data = await getRequestPublic<string[]>(ApiRoutes.geography.regions(countryCode));
    return data ?? [];
  } catch (error) {
    console.error("❌ Error fetching regions:", error);
    return [];
  }
}

/**
 * Registrerer en ny bruker.
 * @param payload - Brukerdata som matcher SignupRequest i AFBack
 * @returns Result med RegisterResponseDTO ved suksess, RegistrationErrorCode ved feil
 */
export async function registerUserAPI(
  payload: RegisterUserPayloadDTO
): Promise<Result<RegisterResponseDTO, RegistrationErrorCode>> {
  try {
    console.log("🟡 Registering user:", payload.email);
    const data = await postRequestPublic<RegisterResponseDTO, RegisterUserPayloadDTO>(
      ApiRoutes.auth.signup,
      payload
    );
    if (!data) return Result.fail("No response received", RegistrationErrorCode.Unknown);
    console.log("✅ User registered successfully");
    return Result.ok(data);
  } catch (error: unknown) {
    return mapRegistrationError(error);
  }
}

/**
 * Mapper en kastet exception til typed RegistrationErrorCode.
 * Skiller mellom RateLimitError, nettverksfeil og generiske serverfeil.
 */
function mapRegistrationError(error: unknown): Result<RegisterResponseDTO, RegistrationErrorCode> {
  if (!(error instanceof Error)) {
    return Result.fail("Unknown error", RegistrationErrorCode.Unknown);
  }

  if (error instanceof RateLimitError) {
    return Result.fail(error.message, RegistrationErrorCode.RateLimited);
  }

  const msg = error.message.toLowerCase();

  if (msg.includes("email") && (msg.includes("exists") || msg.includes("taken") || msg.includes("already"))) {
    return Result.fail(error.message, RegistrationErrorCode.EmailTaken);
  }
  if (msg.includes("429") || msg.includes("too many") || msg.includes("rate limit")) {
    return Result.fail(error.message, RegistrationErrorCode.RateLimited);
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return Result.fail("Network error. Check your connection.", RegistrationErrorCode.NetworkError);
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("server")) {
    return Result.fail("Server error. Please try again later.", RegistrationErrorCode.ServerError);
  }

  return Result.fail(error.message || "Registration failed.", RegistrationErrorCode.Unknown);
}
