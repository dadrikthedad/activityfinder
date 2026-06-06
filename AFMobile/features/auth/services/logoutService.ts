// features/auth/services/logoutService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import authServiceNative from "@/core/auth/authServiceNative";
import { clearAllDrafts } from "@/utils/draft/draft";
import { useChatStore } from "@/store/useChatStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { asyncStorage } from "@/store/indexedNotificationDBStorage";
import { markOfflineWithDefaults } from "@/services/bootstrap/onlineStatusService";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";
import { Result } from "@/core/errors/Result";
import { AuthErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";

export async function logoutUser(userId: string | null): Promise<Result<void, AuthErrorCode>> {
  try {
    await Promise.race([
      markOfflineWithDefaults(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]).catch(() => {});

    if (userId) {
      const cryptoService = CryptoService.getInstance();
      cryptoService.clearUserCache(userId);
      useBootstrapStore.getState().setE2EEState(false, false, null);
    }

    await authServiceNative.logout().catch(() => {});

    useChatStore.getState().reset();
    useNotificationStore.getState().reset();
    useMessageNotificationStore.getState().reset();
    useBootstrapStore.getState().reset();
    useUserCacheStore.getState().reset();

    await Promise.all([
      useChatStore.persist.clearStorage(),
      useNotificationStore.persist.clearStorage(),
      useMessageNotificationStore.persist.clearStorage(),
      useBootstrapStore.persist.clearStorage(),
      useUserCacheStore.persist.clearStorage(),
    ]).catch(() => {});

    await AsyncStorage.multiRemove([
      "userId",
      "messageDropdownSize",
      "messageDropdownPosition",
      "dropdown_convo",
    ]).catch(() => {});

    await Promise.all([
      asyncStorage.removeItem("chat-cache"),
      asyncStorage.removeItem("notif-cache"),
      asyncStorage.removeItem("message-notif-cache"),
      asyncStorage.removeItem("bootstrap-cache"),
      asyncStorage.removeItem("user-cache-enhanced"),
    ]).catch(() => {});

    await clearAllDrafts().catch(() => {});

    return Result.ok(undefined);
  } catch (error: unknown) {
    return mapLogoutError(error);
  }
}

function mapLogoutError(error: unknown): Result<void, AuthErrorCode> {
  if (error instanceof ApiError) {
    if (error.status >= 500)
      return Result.fail("Server error during logout.", AuthErrorCode.ServerError);
    return Result.fail(error.message, AuthErrorCode.Unknown);
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch"))
      return Result.fail("Network error during logout.", AuthErrorCode.NetworkError);
    return Result.fail(error.message, AuthErrorCode.Unknown);
  }

  return Result.fail("An unexpected error occurred during logout.", AuthErrorCode.Unknown);
}
