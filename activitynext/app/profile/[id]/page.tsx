// Dette er profil-siden, her viser vi både vår egen profil og andres profil utifra userId

import { getUserProfile } from "@/services/profile";
import { use } from "react";
import { cookies } from "next/headers";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";
import PublicProfileView from "@/components/profile/PublicProfileView";
// Dette må vi bruke siden det er next 15
type Params = Promise<{ id: string }>;

export default function PublicProfilePage(props: { params: Params }) {
  const { id } = use(props.params);
  const userId = Number(id);
  
  
  const cookieStore = use(cookies()); // 👈 bruker `use()` her i stedet for `await`
  const token = cookieStore.get("token")?.value || null;
  console.log("🟡 Token from cookie:", token);
  const userIdFromToken = getUserIdFromToken(token);
  const rawProfile = use(getUserProfile(userId, token ?? undefined, { cache: "no-store" }));
  const profile = rawProfile as PublicProfileDTO;
  const isOwner = userIdFromToken === userId;



  return (
    <PublicProfileView //Her har vi selve profilen, og vi gir parametere om vi eier eller om vi er på editprofile-siden. 
      profile={profile}
      isEditable={false}
      isOwner={isOwner}
    />
  );
}