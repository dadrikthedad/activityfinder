import { useState, useCallback, useEffect } from "react";
import { getMyProfile } from "@/features/profile/services/profileService";
import { ProfileErrorCode } from "@/core/errors/ErrorCode";
import type { MyProfileResponseDTO } from "@/features/profile/models/MyProfileResponseDTO";

interface UseMyProfileReturn {
  profile: MyProfileResponseDTO | null;
  loading: boolean;
  errorCode: ProfileErrorCode | null;
  refetch: () => Promise<void>;
}

export function useMyProfile(): UseMyProfileReturn {
  const [profile, setProfile] = useState<MyProfileResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<ProfileErrorCode | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);

    const result = await getMyProfile();

    if (!result.success) {
      setErrorCode(result.code);
      setLoading(false);
      return;
    }

    setProfile(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, errorCode, refetch };
}
