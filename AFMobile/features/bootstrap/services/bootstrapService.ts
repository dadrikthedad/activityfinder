import { getRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
import { Result } from "@/core/errors/Result";
import { CriticalBootstrapResponseDTO } from "@shared/types/bootstrap/CriticalBootstrapResponseDTO";
import { SecondaryBootstrapResponseDTO } from "@shared/types/bootstrap/SecondaryBootstrapResponseDTO";

export enum BootstrapErrorCode {
  Unknown = "Unknown",
  NetworkError = "NetworkError",
  Unauthorized = "Unauthorized",
  NotFound = "NotFound",
}

function mapBootstrapError(error: unknown): Result<never, BootstrapErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.Unauthorized:
        return Result.fail(error.message, BootstrapErrorCode.Unauthorized);
      case AppErrorCode.NotFound:
        return Result.fail(error.message, BootstrapErrorCode.NotFound);
    }
  }
  return Result.fail("Bootstrap feilet", BootstrapErrorCode.NetworkError);
}

export async function getCriticalBootstrap(): Promise<Result<CriticalBootstrapResponseDTO, BootstrapErrorCode>> {
  try {
    const data = await getRequest<CriticalBootstrapResponseDTO>(ApiRoutes.bootstrap.critical);
    if (!data) return Result.fail("Ingen data", BootstrapErrorCode.NetworkError);
    return Result.ok(data);
  } catch (error) {
    return mapBootstrapError(error);
  }
}

export async function getSecondaryBootstrap(): Promise<Result<SecondaryBootstrapResponseDTO, BootstrapErrorCode>> {
  try {
    const data = await getRequest<SecondaryBootstrapResponseDTO>(ApiRoutes.bootstrap.secondary);
    if (!data) return Result.fail("Ingen data", BootstrapErrorCode.NetworkError);
    return Result.ok(data);
  } catch (error) {
    return mapBootstrapError(error);
  }
}
