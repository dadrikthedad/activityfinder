// features/auth/services/verificationService.ts
import { ApiRoutes } from "@/core/api/routes";
import { postRequestPublic } from "@/core/api/baseService";
import { Result, VoidResult } from "@/core/errors/Result";
import { VerificationErrorCode, PasswordResetErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

// ========== E-POST VERIFISERING ==========

/**
 * Verifiserer brukerens e-post med 6-sifret kode.
 */
export async function verifyEmailWithCode(
  email: string,
  code: string
): Promise<VoidResult<VerificationErrorCode>> {
  try {
    await postRequestPublic<void, { email: string; code: string }>(
      ApiRoutes.verification.verifyEmail,
      { email, code }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapVerificationError(error);
  }
}

/**
 * Sender en ny verifiserings-e-post til brukeren.
 */
export async function resendVerificationEmail(
  email: string
): Promise<VoidResult<VerificationErrorCode>> {
  try {
    await postRequestPublic<void, { email: string }>(ApiRoutes.verification.resend, { email });
    return Result.okVoid();
  } catch (error: unknown) {
    return mapVerificationError(error);
  }
}

// ========== SMS VERIFISERING ==========

/**
 * Verifiserer brukerens telefonnummer med 6-sifret SMS-kode.
 * Bruker email som identifikator — backend slår opp telefonnummer internt.
 */
export async function verifySmsCode(
  email: string,
  code: string
): Promise<VoidResult<VerificationErrorCode>> {
  try {
    await postRequestPublic<void, { email: string; code: string }>(
      ApiRoutes.verification.verifyPhone,
      { email, code }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapVerificationError(error);
  }
}

/**
 * Sender ny verifiserings-SMS.
 * Bruker email som identifikator — backend slår opp telefonnummer internt.
 */
export async function resendSmsVerification(
  email: string
): Promise<VoidResult<VerificationErrorCode>> {
  try {
    await postRequestPublic<void, { email: string }>(
      ApiRoutes.verification.resendPhone,
      { email }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapVerificationError(error);
  }
}

// ========== PASSORD RESET ==========

/**
 * Sender en e-post med passord-reset-kode til brukeren.
 */
export async function requestPasswordReset(
  email: string
): Promise<VoidResult<PasswordResetErrorCode>> {
  try {
    await postRequestPublic<void, { email: string }>(ApiRoutes.passwordReset.forgot, { email });
    return Result.okVoid();
  } catch (error: unknown) {
    return mapPasswordResetError(error);
  }
}

/**
 * Verifiserer koden fra passord-reset-e-posten.
 */
export async function verifyPasswordResetEmailCode(
  email: string,
  code: string
): Promise<VoidResult<PasswordResetErrorCode>> {
  try {
    await postRequestPublic<void, { email: string; code: string }>(
      ApiRoutes.passwordReset.verifyEmail,
      { email, code }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapPasswordResetError(error);
  }
}

/**
 * Sender SMS-kode for passord-reset.
 * Krever at e-postkoden er verifisert (steg 2) før dette kalles.
 */
export async function sendPasswordResetSms(
  email: string
): Promise<VoidResult<PasswordResetErrorCode>> {
  try {
    await postRequestPublic<void, { email: string }>(
      ApiRoutes.passwordReset.sendSms,
      { email }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapPasswordResetError(error);
  }
}

/**
 * Verifiserer SMS-koden for passord-reset (steg 3b).
 * Ved suksess er backend klar til å ta imot nytt passord i steg 4.
 */
export async function verifyPasswordResetSms(
  email: string,
  code: string
): Promise<VoidResult<PasswordResetErrorCode>> {
  try {
    await postRequestPublic<void, { email: string; code: string }>(
      ApiRoutes.passwordReset.verifySms,
      { email, code }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapPasswordResetError(error);
  }
}

/**
 * Setter nytt passord etter vellykket SMS-kode-verifisering (steg 4).
 * SMS-koden er allerede verifisert i steg 3b — kun email og nytt passord sendes.
 */
export async function resetPassword(
  email: string,
  newPassword: string,
): Promise<VoidResult<PasswordResetErrorCode>> {
  try {
    await postRequestPublic<void, { email: string; newPassword: string }>(
      ApiRoutes.passwordReset.reset,
      { email, newPassword }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapPasswordResetError(error);
  }
}

// ========== FEILMAPPING ==========

/**
 * Mapper ApiError til typed VerificationErrorCode.
 * Bruker appCode (domenespesifikk kode fra AppProblemDetails) fremfor string-matching.
 */
function mapVerificationError(error: unknown): VoidResult<VerificationErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.InvalidCode:
      case AppErrorCode.Validation:
        return Result.failVoid(error.message, VerificationErrorCode.InvalidCode);
      case AppErrorCode.ExpiredCode:
        return Result.failVoid(error.message, VerificationErrorCode.ExpiredCode);
      case AppErrorCode.AlreadyVerified:
      case AppErrorCode.Conflict:
        return Result.failVoid(error.message, VerificationErrorCode.AlreadyVerified);
      case AppErrorCode.TooManyRequests:
        return Result.failVoid(error.message, VerificationErrorCode.RateLimited);
      case AppErrorCode.InternalError:
        return Result.failVoid("Server error. Please try again later.", VerificationErrorCode.ServerError);
      default:
        if (error.status >= 500) {
          return Result.failVoid("Server error. Please try again later.", VerificationErrorCode.ServerError);
        }
        return Result.failVoid(error.message, VerificationErrorCode.Unknown);
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
      return Result.failVoid("Network error. Check your connection.", VerificationErrorCode.NetworkError);
    }
    return Result.failVoid(error.message || "Verification failed.", VerificationErrorCode.Unknown);
  }

  return Result.failVoid("Unknown error", VerificationErrorCode.Unknown);
}

/**
 * Mapper ApiError til typed PasswordResetErrorCode.
 * Bruker appCode (domenespesifikk kode fra AppProblemDetails) fremfor string-matching.
 */
function mapPasswordResetError(error: unknown): VoidResult<PasswordResetErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.InvalidCode:
      case AppErrorCode.Validation:
        return Result.failVoid(error.message, PasswordResetErrorCode.InvalidCode);
      case AppErrorCode.ExpiredCode:
        return Result.failVoid(error.message, PasswordResetErrorCode.ExpiredCode);
      case AppErrorCode.NotFound:
      case AppErrorCode.EmailNotFound:
        return Result.failVoid(error.message, PasswordResetErrorCode.EmailNotFound);
      case AppErrorCode.ResetSessionNotVerified:
        return Result.failVoid(error.message, PasswordResetErrorCode.SessionNotVerified);
      case AppErrorCode.ResetSessionExpired:
        return Result.failVoid(error.message, PasswordResetErrorCode.SessionExpired);
      case AppErrorCode.TooManyRequests:
        return Result.failVoid(error.message, PasswordResetErrorCode.RateLimited);
      case AppErrorCode.InternalError:
        return Result.failVoid("Server error. Please try again later.", PasswordResetErrorCode.ServerError);
      default:
        if (error.status >= 500) {
          return Result.failVoid("Server error. Please try again later.", PasswordResetErrorCode.ServerError);
        }
        return Result.failVoid(error.message || "Password reset failed.", PasswordResetErrorCode.Unknown);
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
      return Result.failVoid("Network error. Check your connection.", PasswordResetErrorCode.NetworkError);
    }
    return Result.failVoid(error.message || "Password reset failed.", PasswordResetErrorCode.Unknown);
  }

  return Result.failVoid("Unknown error", PasswordResetErrorCode.Unknown);
}
