import { useState, useEffect, useCallback } from "react";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { useMyProfile } from "@/features/profile/hooks/useMyProfile";
import { updateProfile } from "@/features/profile/services/profileService";
import { ProfileErrorCode } from "@/core/errors/ErrorCode";
import type { UpdateProfileRequestDTO } from "@/features/profile/models/UpdateProfileRequestDTO";
import type { UserProfileDTO } from "@shared/types/UserProfileDTO";

// Felter som sendes til PUT /api/profile
export interface ProfileForm {
  bio: string;
  websites: string[];
  contactEmail: string;
  contactPhone: string;
  countryCode: string;
  dateOfBirth: string;
}

interface UseProfileSettingsReturn {
  profileForm: ProfileForm;
  setProfileField: <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => void;
  submitProfile: () => Promise<void>;
  submitting: boolean;
  submitErrorCode: ProfileErrorCode | null;
  submitSuccess: boolean;

  // Fra useMyProfile — brukes til å vise navn, bilde osv.
  profile: ReturnType<typeof useMyProfile>["profile"];
  profileLoading: boolean;
  profileErrorCode: ProfileErrorCode | null;
  refetchProfile: () => Promise<void>;
}

export function useProfileSettings(): UseProfileSettingsReturn {
  const currentUser = useUserCacheStore((s) => s.currentUser);
  const setProfile = useUserCacheStore((s) => s.setProfile);

  const { profile, loading: profileLoading, errorCode: profileErrorCode, refetch: refetchProfile } = useMyProfile();

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    bio: "",
    websites: [],
    contactEmail: "",
    contactPhone: "",
    countryCode: "",
    dateOfBirth: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitErrorCode, setSubmitErrorCode] = useState<ProfileErrorCode | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Populer skjemaet når profil-data ankommer fra API
  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      bio: profile.bio ?? "",
      websites: profile.websites ?? [],
      contactEmail: profile.contactEmail ?? "",
      contactPhone: profile.contactPhone ?? "",
      countryCode: profile.countryCode ?? "",
      dateOfBirth: profile.dateOfBirth ?? "",
    });
  }, [profile]);

  const setProfileField = useCallback(
    <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
      setProfileForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const submitProfile = useCallback(async () => {
    setSubmitting(true);
    setSubmitErrorCode(null);
    setSubmitSuccess(false);

    const request: UpdateProfileRequestDTO = {
      countryCode: profileForm.countryCode,
      dateOfBirth: profileForm.dateOfBirth,
      bio: profileForm.bio || undefined,
      websites: profileForm.websites.length > 0 ? profileForm.websites : undefined,
      contactEmail: profileForm.contactEmail || undefined,
      contactPhone: profileForm.contactPhone || undefined,
    };

    const result = await updateProfile(request);

    if (!result.success) {
      setSubmitErrorCode(result.code);
      setSubmitting(false);
      return;
    }

    // Oppdater storen umiddelbart så MyProfileScreen reflekterer endringene
    const updatedProfile: UserProfileDTO = {
      bio: request.bio ?? null,
      websites: request.websites ?? [],
      contactEmail: request.contactEmail ?? null,
      contactPhone: request.contactPhone ?? null,
      countryCode: request.countryCode,
      dateOfBirth: request.dateOfBirth,
      age: profile?.age ?? null,
    };
    setProfile(updatedProfile);

    setSubmitSuccess(true);
    setSubmitting(false);

    // Nullstill suksessmelding etter 3 sek
    setTimeout(() => setSubmitSuccess(false), 3000);
  }, [profileForm]);

  return {
    profileForm,
    setProfileField,
    submitProfile,
    submitting,
    submitErrorCode,
    submitSuccess,
    profile,
    profileLoading,
    profileErrorCode,
    refetchProfile,
  };
}
