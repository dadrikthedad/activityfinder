// features/messages/services/mapMessagingError.ts
// Oversetter backend AppErrorCode → feature-spesifikk MessagingErrorCode.
// Switch på error.appCode (ikke error.status) per prosjektmønster.

import { ApiError } from "@/core/errors/ProblemDetails";
import { Result } from "@/core/errors/Result";
import { MessagingErrorCode } from "@/core/errors/ErrorCode";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

export function mapMessagingError(error: unknown): Result<never, MessagingErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.NotFound:
        return Result.fail(error.message, MessagingErrorCode.RecipientNotFound);
      case AppErrorCode.Forbidden:
        return Result.fail(error.message, MessagingErrorCode.Blocked);
      case AppErrorCode.Conflict:
        return Result.fail(error.message, MessagingErrorCode.AlreadyInGroup);
      case AppErrorCode.Validation:
        return Result.fail(error.message, MessagingErrorCode.ValidationError);
      case AppErrorCode.BadRequest:
        return Result.fail(error.message, MessagingErrorCode.InvalidGroup);
      case AppErrorCode.TooManyRequests:
        return Result.fail(error.message, MessagingErrorCode.RateLimited);
      case AppErrorCode.InvalidPublicKey:
        return Result.fail(error.message, MessagingErrorCode.EncryptionFailed);
      case AppErrorCode.InternalError:
        return Result.fail(error.message, MessagingErrorCode.ServerError);
    }
    if (error.status >= 500)
      return Result.fail(error.message, MessagingErrorCode.ServerError);
    return Result.fail(error.message, MessagingErrorCode.Unknown);
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch"))
      return Result.fail("Nettverksfeil. Sjekk tilkoblingen.", MessagingErrorCode.NetworkError);
    if (msg.includes("encrypt") || msg.includes("public key") || msg.includes("participant key"))
      return Result.fail(error.message, MessagingErrorCode.EncryptionFailed);
    return Result.fail(error.message, MessagingErrorCode.Unknown);
  }

  return Result.fail("Ukjent feil.", MessagingErrorCode.Unknown);
}
