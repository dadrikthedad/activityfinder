import { getRequest, putRequest } from "@/core/api/baseService";
import { ApiError } from "@/core/errors/ProblemDetails";
import { Result, VoidResult } from "@/core/errors/Result";
import { ProfileErrorCode } from "@/core/errors/ErrorCode";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
import { ApiRoutes } from "@/core/api/routes";
import type { MyProfileResponseDTO } from "@/features/profile/models/MyProfileResponseDTO";
import type { PublicProfileResponseDTO } from "@/features/profile/models/PublicProfileResponseDTO";
import type { UpdateProfileRequestDTO } from "@/features/profile/models/UpdateProfileRequestDTO";

export async function getMyProfile(): Promise<Result<MyProfileResponseDTO, ProfileErrorCode>> {
  try {
    const data = await getRequest<MyProfileResponseDTO>(ApiRoutes.profile.me);
    if (!data) return Result.fail("No profile data returned.", ProfileErrorCode.ServerError);
    return Result.ok(data);
  } catch (error: unknown) {
    return mapProfileError(error);
  }
}

export async function getPublicProfile(userId: string): Promise<Result<PublicProfileResponseDTO, ProfileErrorCode>> {
  try {
    const data = await getRequest<PublicProfileResponseDTO>(ApiRoutes.profile.public(userId));
    if (!data) return Result.fail("No profile data returned.", ProfileErrorCode.ServerError);
    return Result.ok(data);
  } catch (error: unknown) {
    return mapProfileError(error);
  }
}

export async function updateProfile(request: UpdateProfileRequestDTO): Promise<VoidResult<ProfileErrorCode>> {
  try {
    await putRequest<void, UpdateProfileRequestDTO>(ApiRoutes.profile.update, request);
    return Result.ok(undefined);
  } catch (error: unknown) {
    return mapProfileError(error);
  }
}

function mapProfileError<T>(error: unknown): Result<T, ProfileErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.NotFound:
        return Result.fail(error.message, ProfileErrorCode.NotFound);
      case AppErrorCode.ValidationError:
      case AppErrorCode.BadRequest:
        return Result.fail(error.message, ProfileErrorCode.ValidationError);
      case AppErrorCode.TooManyRequests:
        return Result.fail(error.message, ProfileErrorCode.NetworkError);
      case AppErrorCode.InternalError:
        return Result.fail("Server error. Please try again later.", ProfileErrorCode.ServerError);
      default:
        if (error.status >= 500)
          return Result.fail("Server error. Please try again later.", ProfileErrorCode.ServerError);
        return Result.fail(error.message, ProfileErrorCode.Unknown);
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
      return Result.fail("Network error. Please check your connection.", ProfileErrorCode.NetworkError);
    return Result.fail(error.message, ProfileErrorCode.Unknown);
  }

  return Result.fail("An unexpected error occurred.", ProfileErrorCode.Unknown);
}
