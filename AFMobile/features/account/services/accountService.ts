// features/account/services/accountService.ts
import { postRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode as SharedErrorCode } from "@shared/types/error/AppErrorCode";
import { Result, VoidResult } from "@/core/errors/Result";
import { AccountErrorCode } from "@/core/errors/ErrorCode";

function mapAccountError(error: unknown): VoidResult<AccountErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case SharedErrorCode.InvalidPassword:
        return Result.failVoid(error.message, AccountErrorCode.InvalidCurrentPassword);
      case SharedErrorCode.Conflict:
        return Result.failVoid(error.message, AccountErrorCode.Conflict);
      case SharedErrorCode.InvalidCode:
        return Result.failVoid(error.message, AccountErrorCode.InvalidCode);
      case SharedErrorCode.ExpiredCode:
        return Result.failVoid(error.message, AccountErrorCode.ExpiredCode);
      case SharedErrorCode.TooManyRequests:
        return Result.failVoid(error.message, AccountErrorCode.RateLimited);
    }
    if (error.status === 429)
      return Result.failVoid(error.message, AccountErrorCode.RateLimited);
    if (error.status >= 500)
      return Result.failVoid(error.message, AccountErrorCode.ServerError);
  }
  if (error instanceof TypeError)
    return Result.failVoid("Nettverksfeil. Sjekk internettforbindelsen.", AccountErrorCode.NetworkError);
  return Result.failVoid("En ukjent feil oppstod.", AccountErrorCode.Unknown);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { currentPassword: string; newPassword: string; confirmNewPassword: string }>(
      ApiRoutes.passwordReset.changePassword,
      { currentPassword, newPassword, confirmNewPassword },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}

export async function requestEmailChange(
  currentPassword: string,
  newEmail: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { currentPassword: string; newEmail: string }>(
      ApiRoutes.account.requestEmailChange,
      { currentPassword, newEmail },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}

export async function verifyCurrentEmailForChange(
  code: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { code: string }>(
      ApiRoutes.account.verifyCurrentEmail,
      { code },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}

export async function verifyNewEmail(
  code: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { code: string }>(
      ApiRoutes.account.verifyEmailChange,
      { code },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}

export async function requestPhoneChange(
  currentPassword: string,
  newPhone: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { currentPassword: string; newPhoneNumber: string }>(
      ApiRoutes.account.requestPhoneChange,
      { currentPassword, newPhoneNumber: newPhone },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}

export async function verifyEmailForPhoneChange(
  code: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { code: string }>(
      ApiRoutes.account.verifyCurrentEmailPhone,
      { code },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}

export async function verifyNewPhone(
  code: string,
): Promise<VoidResult<AccountErrorCode>> {
  try {
    await postRequest<void, { code: string }>(
      ApiRoutes.account.verifyPhoneChange,
      { code },
    );
    return Result.okVoid();
  } catch (error) {
    return mapAccountError(error);
  }
}
