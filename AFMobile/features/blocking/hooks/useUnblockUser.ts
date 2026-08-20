import { useState } from "react";
import { unblockUser } from "../services/blockService";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { VoidResult } from "@/core/errors/Result";
import { BlockingErrorCode } from "@/core/errors/ErrorCode";

export function useUnblockUser() {
  const [isLoading, setIsLoading] = useState(false);

  const handleUnblockUser = async (userId: string): Promise<VoidResult<BlockingErrorCode>> => {
    setIsLoading(true);
    const result = await unblockUser(userId);
    if (result.success) {
      useUserCacheStore.getState().removeBlockedUser(userId);
    }
    setIsLoading(false);
    return result;
  };

  return { unblockUser: handleUnblockUser, isLoading };
}
