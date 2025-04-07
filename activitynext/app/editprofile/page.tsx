
import { getUserProfile } from "@/services/profile";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { cookies } from "next/headers";
import { use } from "react";
import PublicProfileView from "@/components/profile/PublicProfileView";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";

export default function EditProfilePage() {
  const cookieStore = use(cookies());
  const token = cookieStore.get("token")?.value || null;
  const userId = getUserIdFromToken(token);

  if (!userId) {
    return (
      <div className="text-center mt-10 text-red-500">
        Invalid or missing user ID
      </div>
    );
  }


  const rawProfile = use(getUserProfile(userId, token ?? undefined, { cache: "no-store" }));
  const profile = rawProfile as PublicProfileDTO;

  console.log("✅ Profile loaded in edit:", profile);

  return (
    <>
      <PublicProfileView
        profile={profile}
        isEditable={true}
        isOwner={true}
      />
    </>
  )};