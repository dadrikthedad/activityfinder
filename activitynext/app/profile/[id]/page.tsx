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
  const { id } = use(props.params); // Hent `userId` fra URL
  const userId = Number(id);
  
  
  const cookieStore = use(cookies()); // Hent token fra cookies (server-side i Next.js 15)
  const token = cookieStore.get("token")?.value || null;
  console.log("🟡 Token from cookie:", token);
  
  const userIdFromToken = getUserIdFromToken(token); //  Dekod token for å hente ID til den innloggede brukeren
  
  const rawProfile = use(getUserProfile(userId, token ?? undefined, { cache: "no-store" })); // Hent profilen til brukeren vi besøker (kan være vår egen eller andres)
  const profile = rawProfile as PublicProfileDTO;
  const isOwner = userIdFromToken === userId; // Sjekk om dette er vår egen profil



  return (
    <div className="flex flex-col gap-20 max-w-4xl mx-auto px-4 py-10 min-h-screen">
    <PublicProfileView //Her har vi selve profilen, og vi gir parametere om vi eier eller om vi er på editprofile-siden. 
      profile={profile}
      isEditable={false}
      isOwner={isOwner}
    />
    </div>
  );
}