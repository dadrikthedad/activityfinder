// features/auth/services/authService.ts
import { LoginResponseDTO } from "@/features/auth/models/LoginResponseDTO";
import { Result } from "@/core/errors/Result";
import { AuthErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
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
 * Mapper ApiError til typed AuthErrorCode.
 * Bruker appCode (domenespesifikk kode fra AppProblemDetails) fremfor string-matching.
 */
function mapLoginError(error: unknown): Result<LoginResponseDTO, AuthErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.EmailNotConfirmed:
        return Result.fail(error.message, AuthErrorCode.EmailNotVerified);
      case AppErrorCode.PhoneNotConfirmed:
        return Result.fail(error.message, AuthErrorCode.PhoneNotVerified);
      case AppErrorCode.InvalidCredentials:
        return Result.fail("Wrong email or password. Please try again.", AuthErrorCode.InvalidCredentials);
      case AppErrorCode.AccountLocked:
        return Result.fail(error.message, AuthErrorCode.AccountLocked);
      case AppErrorCode.TooManyRequests:
        return Result.fail("Too many login attempts. Please wait a moment.", AuthErrorCode.RateLimited);
      case AppErrorCode.InternalError:
        return Result.fail("Server error. Please try again later.", AuthErrorCode.ServerError);
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
