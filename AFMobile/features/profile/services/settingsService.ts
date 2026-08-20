import { getRequest, putRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
import { Result, VoidResult } from "@/core/errors/Result";
import { ProfileErrorCode } from "@/core/errors/ErrorCode";
import { UserSettingsDTO } from "@shared/types/UserSettingsDTO";

function mapSettingsError(error: unknown): Result<never, ProfileErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.TooManyRequests:
        return Result.fail(error.message, ProfileErrorCode.NetworkError);
    }
    return Result.fail(error.message, ProfileErrorCode.ServerError);
  }
  return Result.fail("An unexpected error occurred.", ProfileErrorCode.Unknown);
}

export async function getSettings(): Promise<Result<UserSettingsDTO, ProfileErrorCode>> {
  try {
    const data = await getRequest<UserSettingsDTO>(ApiRoutes.settings.get);
    return Result.ok(data);
  } catch (error) {
    return mapSettingsError(error);
  }
}

export async function updateSettings(settings: UserSettingsDTO): Promise<VoidResult<ProfileErrorCode>> {
  try {
    await putRequest<void, UserSettingsDTO>(ApiRoutes.settings.update, settings);
    return Result.ok(undefined);
  } catch (error) {
    return mapSettingsError(error) as VoidResult<ProfileErrorCode>;
  }
}
