// features/auth/services/verificationService.ts
import { ApiRoutes } from "@/core/api/routes";
import { postRequestPublic } from "@/core/api/baseService";
import { Result, VoidResult } from "@/core/errors/Result";
import { VerificationErrorCode, PasswordResetErrorCode } from "@/core/errors/ErrorCode";
import { RateLimitError } from "@shared/types/security/RateLimitError";

// ========== E-POST VERIFISERING ==========

/**
 * Verifiserer brukerens e-post med 6-sifret kode.
 * @param email - Brukerens e-postadresse
 * @param code - 6-sifret verifiseringskode fra e-post
 * @returns VoidResult — VerificationErrorCode ved feil
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
 * @param email - Brukerens e-postadresse
 * @returns VoidResult — VerificationErrorCode ved feil
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
 * @param email - Brukerens e-postadresse
 * @param code - 6-sifret kode fra SMS
 * @returns VoidResult — VerificationErrorCode ved feil
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
 * @param email - Brukerens e-postadresse
 * @returns VoidResult — VerificationErrorCode ved feil
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
 * @param email - Brukerens e-postadresse
 * @returns VoidResult — PasswordResetErrorCode ved feil
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
 * @param email - Brukerens e-postadresse
 * @param code - 6-sifret kode fra e-post
 * @returns VoidResult — PasswordResetErrorCode ved feil
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
 * Setter nytt passord etter vellykket kode-verifisering.
 * @param email - Brukerens e-postadresse
 * @param code - Den verifiserte reset-koden
 * @param newPassword - Nytt passord (validert mot AFBack passordregler)
 * @returns VoidResult — PasswordResetErrorCode ved feil
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<VoidResult<PasswordResetErrorCode>> {
  try {
    await postRequestPublic<void, { email: string; code: string; newPassword: string }>(
      ApiRoutes.passwordReset.reset,
      { email, code, newPassword }
    );
    return Result.okVoid();
  } catch (error: unknown) {
    return mapPasswordResetError(error);
  }
}

// ========== FEILMAPPING ==========

/**
 * Mapper en kastet exception til typed VerificationErrorCode.
 */
function mapVerificationError(error: unknown): VoidResult<VerificationErrorCode> {
  if (!(error instanceof Error)) {
    return Result.failVoid("Unknown error", VerificationErrorCode.Unknown);
  }

  if (error instanceof RateLimitError) {
    return Result.failVoid(error.message, VerificationErrorCode.RateLimited);
  }

  const msg = error.message.toLowerCase();

  if (msg.includes("invalid") || msg.includes("incorrect") || msg.includes("wrong")) {
    return Result.failVoid(error.message, VerificationErrorCode.InvalidCode);
  }
  if (msg.includes("expired")) {
    return Result.failVoid(error.message, VerificationErrorCode.ExpiredCode);
  }
  if (msg.includes("already verified")) {
    return Result.failVoid(error.message, VerificationErrorCode.AlreadyVerified);
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return Result.failVoid("Network error. Check your connection.", VerificationErrorCode.NetworkError);
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("server")) {
    return Result.failVoid("Server error. Please try again later.", VerificationErrorCode.ServerError);
  }

  return Result.failVoid(error.message || "Verification failed.", VerificationErrorCode.Unknown);
}

/**
 * Mapper en kastet exception til typed PasswordResetErrorCode.
 */
function mapPasswordResetError(error: unknown): VoidResult<PasswordResetErrorCode> {
  if (!(error instanceof Error)) {
    return Result.failVoid("Unknown error", PasswordResetErrorCode.Unknown);
  }

  if (error instanceof RateLimitError) {
    return Result.failVoid(error.message, PasswordResetErrorCode.RateLimited);
  }

  const msg = error.message.toLowerCase();

  if (msg.includes("invalid") || msg.includes("incorrect") || msg.includes("wrong")) {
    return Result.failVoid(error.message, PasswordResetErrorCode.InvalidCode);
  }
  if (msg.includes("expired")) {
    return Result.failVoid(error.message, PasswordResetErrorCode.ExpiredCode);
  }
  if (msg.includes("not found") || msg.includes("no account")) {
    return Result.failVoid(error.message, PasswordResetErrorCode.EmailNotFound);
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return Result.failVoid("Network error. Check your connection.", PasswordResetErrorCode.NetworkError);
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("server")) {
    return Result.failVoid("Server error. Please try again later.", PasswordResetErrorCode.ServerError);
  }

  return Result.failVoid(error.message || "Password reset failed.", PasswordResetErrorCode.Unknown);
}
