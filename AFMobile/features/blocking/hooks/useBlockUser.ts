import { useState } from "react";
import { blockUser } from "../services/blockService";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { VoidResult } from "@/core/errors/Result";
import { BlockingErrorCode } from "@/core/errors/ErrorCode";

interface BlockUserMeta {
  fullName: string;
  profileImageUrl?: string | null;
}

export function useBlockUser() {
  const [isLoading, setIsLoading] = useState(false);

  const handleBlockUser = async (userId: string, meta?: BlockUserMeta): Promise<VoidResult<BlockingErrorCode>> => {
    setIsLoading(true);
    const result = await blockUser(userId);
    if (result.success && meta) {
      useUserCacheStore.getState().addBlockedUser({
        userId,
        fullName: meta.fullName,
        profileImageUrl: meta.profileImageUrl ?? null,
        blockedAt: new Date().toISOString(),
      });
    }
    setIsLoading(false);
    return result;
  };

  return { blockUser: handleBlockUser, isLoading };
}
