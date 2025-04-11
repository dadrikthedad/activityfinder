// Denne viser profilen til en bruker både på profile/[id] og editprofile. Henter info fra PublicProfileDTO for å vise info

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
  profile: initialProfile, // Vi gir profilnavn initialProfile slik at det ikke blir forvirring mot profile
  isEditable = false,
  isOwner = false,
}: {
  profile: PublicProfileDTO; // Hentet med API med PublicProfileDTO
  isEditable?: boolean; // isEditable blir satt hvis vi er på editprofile
  isOwner?: boolean; // vi sjekker om vi er brukeren og setter denne true hvis vi er det
}) {
  const [profile, setProfile] = useState(initialProfile); // ✅ må kalles initialProfile her
  const [reloadCounter ] = useState(0);
  const { token } = useAuth(); // Henter token

  // Her 
  const imageUrl =
    profile.profileImageUrl?.trim() !== ""
      ? profile.profileImageUrl
      : "/default-avatar.png";

  const isFriend = false; // TODO Sjekke om vi er venn for å gi egne options

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
    <div className="max-w-5xl mx-auto px-6 py-10">
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
