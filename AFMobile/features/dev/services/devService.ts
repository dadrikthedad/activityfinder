// features/dev/services/devService.ts
// Kun for Development — henter alle brukere og logger inn som en vilkårlig bruker.
// Følger Result-pattern på linje med authService.

import { Result } from "@/core/errors/Result";
import { DevErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
import { getRequestPublic } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { DevUserDTO } from "@/features/dev/models/DevUserDTO";
import { LoginResponseDTO } from "@/features/auth/models/LoginResponseDTO";
import authServiceNative from "@/core/auth/authServiceNative";

/**
 * Henter alle brukere i databasen (kun Development).
 */
export async function getDevUsers(): Promise<Result<DevUserDTO[], DevErrorCode>> {
  try {
    const data = await getRequestPublic<DevUserDTO[]>(ApiRoutes.dev.users);
    return Result.ok(data ?? []);
  } catch (error: unknown) {
    return mapDevError(error);
  }
}

/**
 * Logger inn som den valgte brukeren (kun Development).
 * Tokens lagres automatisk i Keychain av authServiceNative.devLoginAs.
 */
export async function devLoginAsUser(
  email: string,
): Promise<Result<LoginResponseDTO, DevErrorCode>> {
  try {
    const data = await authServiceNative.devLoginAs(email);
    return Result.ok(data);
  } catch (error: unknown) {
    return mapDevError(error);
  }
}

function mapDevError<T>(error: unknown): Result<T, DevErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.NotFound:
        return Result.fail("User not found.", DevErrorCode.NotFound);
      case AppErrorCode.InternalError:
        return Result.fail("Server error. Please try again later.", DevErrorCode.ServerError);
      default:
        if (error.status >= 500)
          return Result.fail("Server error. Please try again later.", DevErrorCode.ServerError);
        return Result.fail(error.message, DevErrorCode.Unknown);
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
      return Result.fail("Network error. Please check your connection.", DevErrorCode.NetworkError);
    return Result.fail(error.message, DevErrorCode.Unknown);
  }

  return Result.fail("An unexpected error occurred.", DevErrorCode.Unknown);
}
