// features/auth/services/signUpService.ts
import { ApiRoutes } from "@/core/api/routes";
import { RegisterResponseDTO } from "@/features/auth/models/RegisterResponseDTO";
import { RegisterUserPayloadDTO } from "@/features/auth/models/RegisterUserPayloadDTO";
import { getRequestPublic, postRequestPublic } from "@/core/api/baseService";
import { Result } from "@/core/errors/Result";
import { RegistrationErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

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
 * Mapper ApiError til typed RegistrationErrorCode.
 * Bruker appCode (domenespesifikk kode fra AppProblemDetails) fremfor string-matching.
 */
function mapRegistrationError(error: unknown): Result<RegisterResponseDTO, RegistrationErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.Conflict:
      case AppErrorCode.EmailAlreadyExists:
        return Result.fail(error.message, RegistrationErrorCode.EmailTaken);
      case AppErrorCode.InvalidRegistrationData:
      case AppErrorCode.Validation:
        return Result.fail(error.message, RegistrationErrorCode.InvalidData);
      case AppErrorCode.TooManyRequests:
        return Result.fail(error.message, RegistrationErrorCode.RateLimited);
      case AppErrorCode.InternalError:
      case AppErrorCode.EmailSendFailed:
        return Result.fail("Server error. Please try again later.", RegistrationErrorCode.ServerError);
      default:
        if (error.status >= 500) {
          return Result.fail("Server error. Please try again later.", RegistrationErrorCode.ServerError);
        }
        return Result.fail(error.message, RegistrationErrorCode.Unknown);
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
      return Result.fail("Network error. Check your connection.", RegistrationErrorCode.NetworkError);
    }
    return Result.fail(error.message || "Registration failed.", RegistrationErrorCode.Unknown);
  }

  return Result.fail("Unknown error", RegistrationErrorCode.Unknown);
}
