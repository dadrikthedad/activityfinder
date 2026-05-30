// features/auth/services/encryptionService.ts
import { getRequest, postRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";
import { Result, VoidResult } from "@/core/errors/Result";
import { E2EESetupErrorCode } from "@/core/errors/ErrorCode";

export interface UserPublicKeyResponse {
  userId: string;
  publicKey: string;
  keyVersion: number;
}

export interface StoreEncryptionKeysResponse {
  keyVersion: number;
}

export async function getMyPublicKey(): Promise<Result<UserPublicKeyResponse, E2EESetupErrorCode>> {
  try {
    const data = await getRequest<UserPublicKeyResponse>(ApiRoutes.encryption.myPublicKey);
    if (!data) return Result.fail("No key found", E2EESetupErrorCode.NetworkError);
    return Result.ok(data);
  } catch (error) {
    if (error instanceof ApiError && error.appCode === AppErrorCode.NotFound)
      return Result.fail("No public key found", E2EESetupErrorCode.Unknown);
    return Result.fail("Failed to fetch public key", E2EESetupErrorCode.NetworkError);
  }
}

export async function storeEncryptionKeys(
  publicKey: string,
  recoverySeed: string
): Promise<VoidResult<E2EESetupErrorCode>> {
  try {
    await postRequest<StoreEncryptionKeysResponse, { publicKey: string; recoverySeed: string }>(
      ApiRoutes.encryption.keys,
      { publicKey, recoverySeed }
    );
    return Result.okVoid();
  } catch {
    return Result.failVoid("Failed to store encryption keys", E2EESetupErrorCode.StorageFailed);
  }
}
