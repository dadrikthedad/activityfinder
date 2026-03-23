// features/auth/services/authService.ts
import { LoginResponseDTO } from "@/features/auth/models/LoginResponseDTO";
import { Result } from "@/core/errors/Result";
import { AuthErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";
import authServiceNative from "@/core/auth/authServiceNative";

/**
 * Logger inn brukeren via authServiceNative og returnerer Result.
 * Håndterer alle feiltilfeller uten å kaste exceptions.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<Result<LoginResponseDTO, AuthErrorCode>> {
  try {
    const data = await authServiceNative.login(email, password);
    return Result.ok(data);
  } catch (error: unknown) {
    return mapLoginError(error);
  }
}

/**
 * Mapper ApiError (med HTTP-statuskode) til typed AuthErrorCode.
 * Bruker statuskode fremfor string-matching — mer robust mot endringer i backend-meldinger.
 * Unntak: 401 skiller e-post vs. telefon på meldingstekst siden begge returnerer samme statuskode.
 */
function mapLoginError(error: unknown): Result<LoginResponseDTO, AuthErrorCode> {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401: {
        const msg = error.message.toLowerCase();
        if (msg.includes("phone number is not yet verified")) {
          return Result.fail(error.message, AuthErrorCode.PhoneNotVerified);
        }
        if (msg.includes("not yet verified")) {
          return Result.fail(error.message, AuthErrorCode.EmailNotVerified);
        }
        return Result.fail(
          "Wrong email or password. Please try again.",
          AuthErrorCode.InvalidCredentials,
        );
      }
      case 403:
        return Result.fail(
          "Your account has been locked. Please contact support.",
          AuthErrorCode.AccountLocked,
        );
      case 429:
        return Result.fail(
          "Too many login attempts. Please wait a moment.",
          AuthErrorCode.RateLimited,
        );
      case 422:
        return Result.fail(error.message, AuthErrorCode.InvalidCredentials);
      default:
        if (error.status >= 500) {
          return Result.fail("Server error. Please try again later.", AuthErrorCode.ServerError);
        }
        return Result.fail(error.message, AuthErrorCode.Unknown);
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
      return Result.fail("Network error. Please check your connection.", AuthErrorCode.NetworkError);
    }
    return Result.fail(error.message, AuthErrorCode.Unknown);
  }

  return Result.fail("An unexpected error occurred.", AuthErrorCode.Unknown);
}
