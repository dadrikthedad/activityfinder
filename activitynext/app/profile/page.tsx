"use client";

import { useProfile } from "@/hooks/useProfile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import FormButton from "@/components/FormButton";
import Link from "next/link";

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
          {/* Basic Info */}
          {!isEmpty(user) && (
            <div className="bg-white dark:bg-zinc-800 shadow-md rounded-xl p-6 space-y-2 mt-6">
              <h2 className="text-xl font-semibold mb-2">Basic Info</h2>

              {!isEmpty(user?.fullName) && <p><strong>Name:</strong> {user?.fullName}</p>}
              {!isEmpty(user?.email) && <p><strong>Email:</strong> {user?.email}</p>}
              {!isEmpty(user?.dateOfBirth) && (
               <p><strong>Date of Birth: </strong> 
               {(() => {
                   try {
                       return user?.dateOfBirth
                       ? new Date(user.dateOfBirth).toLocaleDateString("no-NO", {
                           day: "2-digit",
                           month: "long",
                           year: "numeric",
                           })
                       : "—";
                   } catch (err) {
                       console.error("❌ Feil med dateOfBirth:", err, user?.dateOfBirth);
                       return "Invalid date.";
                   }
                   })()}</p>
              )}
              {!isEmpty(user?.phone) && <p><strong>Phone:</strong> {user?.phone}</p>}
              {!isEmpty(user?.country) && (
                <p>
                  <strong>Location:</strong> {user?.country}
                  {user?.region && `, ${user.region}`}
                </p>
              )}
              {!isEmpty(user?.postalCode) && <p><strong>Postal Code:</strong> {user?.postalCode}</p>}
              {!isEmpty(user?.gender) && <p><strong>Gender:</strong> {user?.gender}</p>}
              <div className="mt-8"></div>
              {/* Activity stats*/}
              <h2 className="text-xl font-semibold mb-2">Stats</h2>

              {!isEmpty(profile?.totalLikesGiven) && (
                <p><strong>Likes Given:</strong> {profile?.totalLikesGiven}</p>
              )}
              {!isEmpty(profile?.totalLikesRecieved) && (
                <p><strong>Likes Received:</strong> {profile?.totalLikesRecieved}</p>
              )}
              {!isEmpty(profile?.totalCommentsMade) && (
                <p><strong>Comments Made:</strong> {profile?.totalCommentsMade}</p>
              )}
              {!isEmpty(profile?.totalMessagesRecieved) && (
                <p><strong>Messages Received:</strong> {profile?.totalMessagesRecieved}</p>
              )}
              {!isEmpty(profile?.updatedAt) && (
                <p>
                <strong>Last Updated:</strong>{" "}
                {(() => {
                    try {
                        return profile?.updatedAt
                        ? new Date(profile.updatedAt).toLocaleString("no-NO", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            })
                        : "—";
                    } catch (err) {
                        console.error("❌ Feil med updatedAt:", err, profile?.updatedAt);
                        return "Invalid date";
                    }
                    })()}
            </p>
              )}
            </div>
          )}
        </div>

        {/* Right – Profile Picture + Buttons */}
        <div className="flex flex-col items-center md:justify-end mt-16 md:mt-32 space-y-6">
            {/* Bilde */}
            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-green-700 shadow-md">
                <img
                    src={imageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Knapper under */}
            <div className="flex flex-col space-y-4 w-full items-center">
                <Link href="/changeprofilepic" passHref>
                    <FormButton
                    text="Change picture"
                    type="button"
                    fullWidth={false}
                    // 👇 Ekstra styling her
                    className="text-lg px-15 py-3"
                    />
                </Link>

                <Link href="/profilesettings" passHref>
                    <FormButton
                    text="Edit profile"
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
