"use client";

import { useProfile } from "@/hooks/useProfile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import FormButton from "@/components/FormButton";
import Link from "next/link";
import ProfileInfoCard from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatar";

// Hjelpefunksjon for å sjekke om en verdi er "tom"
const isEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
  
    if (typeof value === "string" && value.trim() === "") return true;
  
    if (Array.isArray(value) && value.length === 0) return true;
  
    return false;
  };
  

export default function ProfilePage() {
  const { user, loading: loadingUser, error: errorUser } = useCurrentUser();
  const { profile, loading: loadingProfile, error: errorProfile } = useProfile();

  if (loadingUser || loadingProfile) {
    return <div className="text-center mt-10">Loading your profile...</div>;
  }

  if (errorUser || errorProfile) {
    return (
      <div className="text-center text-red-500 mt-10">
        Failed to load profile: {errorUser || errorProfile}
      </div>
    );
  }

  if (!user && !profile) {
    return (
      <div className="text-center text-gray-600 mt-10">
        No profile data found.
      </div>
    );
  }

  const imageUrl =
  profile?.profileImageUrl && profile.profileImageUrl.trim() !== ""
    ? profile.profileImageUrl
    : "/default-avatar.png";

  // flex flex-col items-center justify-start min-h-screen px-6 py-12 mt-24 bg-black text-white
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center">Your Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left – User Info & Stats */}
        <div className="md:col-span-2 space-y-4">
          {!isEmpty(user) && (
            <ProfileInfoCard user={user} profile={profile} showEmail={false} />
          )}
        </div>

        {/* Right – Profile Picture + Buttons */}
        <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
            {/* Bilde */}
            <ProfileAvatar
              imageUrl={imageUrl}
              isEditable={false} // eller false avhengig av side // hvis du har det
            />

            {/* Knapper under */}
            <div className="flex flex-col space-y-4 w-full items-center">
                <Link href="/editprofile" passHref>
                    <FormButton
                    text="Edit Profile"
                    type="button"
                    fullWidth={false}
                    // 👇 Ekstra styling her
                    className="text-lg px-17 py-3"
                    />
                </Link>

                <Link href="/profilesettings" passHref>
                    <FormButton
                    text="Settings"
                    type="button"
                    fullWidth={false}
                    className="text-lg px-20 py-3"
                    />
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
