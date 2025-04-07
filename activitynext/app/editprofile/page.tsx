"use client";

import { useProfile } from "@/hooks/useProfile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import ProfileInfoCard from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileNavButton from "@/components/settings/ProfileNavButton";

export default function ProfilePage() {
  const { user, loading: loadingUser, error: errorUser } = useCurrentUser();
  const { profile, loading: loadingProfile, error: errorProfile, refetch: refetchProfile } = useProfile();




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

  if (!user || !profile) {
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


      return (
        <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen">
          <h1 className="text-3xl font-bold mb-6 text-center">Edit Profile</h1>
      
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Venstre side */}
            <div className="md:col-span-2 space-y-4">
              <ProfileInfoCard
                profile={profile}
                showEmail={false}
                isEditable={true}
                refetchProfile={refetchProfile}
              />
            </div>
      
            {/* Høyre side */}
            <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
            <ProfileAvatar
                imageUrl={imageUrl}
                isEditable={true} // eller false avhengig av side
                refetchProfile={refetchProfile} // hvis du har det
            />

            <ProfileNavButton href="/profile" text="Back to Profile" variant="long" />
            </div>
          </div>
        </div>

        
      );
}
