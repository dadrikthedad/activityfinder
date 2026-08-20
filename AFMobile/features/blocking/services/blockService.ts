import { postRequest, deleteRequest, getRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { Result, VoidResult } from "@/core/errors/Result";
import { BlockingErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode as SharedAppErrorCode } from "@shared/types/error/AppErrorCode";
import { BlockedUserResponseDTO } from "../models/BlockedUserResponseDTO";

export async function blockUser(userId: string): Promise<VoidResult<BlockingErrorCode>> {
  try {
    await postRequest<void, void>(ApiRoutes.blocking.block(userId), undefined);
    return Result.okVoid();
  } catch (error) {
    return mapBlockError(error);
  }
}

export async function unblockUser(userId: string): Promise<VoidResult<BlockingErrorCode>> {
  try {
    await deleteRequest<void>(ApiRoutes.blocking.unblock(userId));
    return Result.okVoid();
  } catch (error) {
    return mapBlockError(error);
  }
}

export async function getBlockedUsers(): Promise<Result<BlockedUserResponseDTO[], BlockingErrorCode>> {
  try {
    const data = await getRequest<BlockedUserResponseDTO[]>(ApiRoutes.blocking.blockedUsers);
    return Result.ok(data ?? []);
  } catch (error) {
    return mapBlockError(error) as Result<BlockedUserResponseDTO[], BlockingErrorCode>;
  }
}

function mapBlockError(error: unknown): VoidResult<BlockingErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case SharedAppErrorCode.Conflict:
        // Returner AlreadyBlocked eller NotBlocked avhengig av kontekst — caller velger tolkning
        return Result.failVoid(error.message, BlockingErrorCode.AlreadyBlocked);
      case SharedAppErrorCode.NotFound:
        return Result.failVoid(error.message, BlockingErrorCode.UserNotFound);
      case SharedAppErrorCode.TooManyRequests:
        return Result.failVoid(error.message, BlockingErrorCode.RateLimited);
    }
    if (error.status >= 500) return Result.failVoid(error.message, BlockingErrorCode.ServerError);
    return Result.failVoid(error.message, BlockingErrorCode.Unknown);
  }
  return Result.failVoid("An unexpected error occurred.", BlockingErrorCode.Unknown);
}
