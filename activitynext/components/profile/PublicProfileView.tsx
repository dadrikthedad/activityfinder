"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/services/profile";
import ProfileInfoCard from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import ProfileActionMenu from "@/components/profile/ProfileActionMenu";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";

export default function PublicProfileView({
  profile: initialProfile,
  isEditable = false,
  isOwner = false,
}: {
  profile: PublicProfileDTO;
  isEditable?: boolean;
  isOwner?: boolean;
}) {
  const [profile, setProfile] = useState(initialProfile); // ✅ må kalles initialProfile her
  const [reloadCounter ] = useState(0);
  const { token } = useAuth();

  const imageUrl =
    profile.profileImageUrl?.trim() !== ""
      ? profile.profileImageUrl
      : "/default-avatar.png";

  const isFriend = false; // TODO

  const refetchProfile = useCallback(async () => {
    if (!initialProfile?.userId || !token) return;
    try {
      const updated = await getUserProfile(initialProfile.userId, token);
      setProfile(updated);
    } catch (error) {
      console.error("❌ Failed to refetch profile", error);
    }
  }, [initialProfile?.userId, token]);

  // Optional: trigge re-fetch automatisk
  useEffect(() => {
    if (isEditable) {
      refetchProfile();
    }
  }, [reloadCounter, isEditable, refetchProfile]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {isOwner ? "Your Profile" : "User Profile"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 space-y-4">
          <ProfileInfoCard
            profile={profile}
            showEmail={profile.showEmail}
            isEditable={isEditable}
            refetchProfile={refetchProfile}
          />
        </div>

        <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
          <ProfileAvatar
            imageUrl={imageUrl ?? "/default-avatar.png"}
            isEditable={isEditable}
            refetchProfile={refetchProfile}
          />

          {isOwner ? (
            isEditable ? (
              <>
                <ProfileNavButton
                  href={`/profile/${profile.userId}`}
                  text="Back to Profile"
                  variant="long"
                />
                <ProfileNavButton
                  href="/profilesettings"
                  text="Settings"
                  variant="long"
                />
              </>
            ) : (
              <>
                <ProfileNavButton
                  href="/editprofile"
                  text="Edit Profile"
                  variant="long"
                />
                <ProfileNavButton
                  href="/profilesettings"
                  text="Settings"
                  variant="long"
                />
              </>
            )
          ) : (
            <>
              {isFriend ? (
                <>
                  <ProfileNavButton
                    href="#"
                    text="Send Message"
                    variant="long"
                  />
                  <ProfileNavButton
                    href="#"
                    text="Follow User"
                    variant="long"
                  />
                </>
              ) : (
                <>
                  <ProfileNavButton
                    href="#"
                    text="Add as Friend"
                    variant="long"
                  />
                  <ProfileNavButton
                    href="#"
                    text="Send Message"
                    variant="long"
                  />
                  <ProfileNavButton
                    href="#"
                    text="Follow User"
                    variant="long"
                  />
                </>
              )}
              <ProfileActionMenu />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
