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
import SimpleFriendList from "@/components/friends/SimpleFriendList";


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
  const [reloadCounter ] = useState(0); // Brukes til å trigge refetch av siden ved subtmitting til backend
  const { token } = useAuth(); // Henter token

  // Her bruker vi et default bilde hvis bruker ikke har ett
  const imageUrl =
    profile.profileImageUrl?.trim() !== ""
      ? profile.profileImageUrl
      : "/default-avatar.png";

  const isFriend = false; // TODO Sjekke om vi er venn for å gi egne options

  const refetchProfile = useCallback(async () => { // Henter en ny oppdatert versjon av profilen med API etter en ednring
    if (!initialProfile?.userId || !token) return;
    try {
      const updated = await getUserProfile(initialProfile.userId, token);
      setProfile(updated);
    } catch (error) {
      console.error("❌ Failed to refetch profile", error);
    }
  }, [initialProfile?.userId, token]);

  // Trigge re-fetch automatisk ved endringer
  useEffect(() => {
    if (isEditable) {
      refetchProfile();
    }
  }, [reloadCounter, isEditable, refetchProfile]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#145214]">
        {isOwner ? "Your Profile" : "User Profile"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 space-y-4">
          <ProfileInfoCard // Her viser vi feltene på venstre side, alt fra PublicProfileDTO. Kan endres slik som på editprofile
            profile={profile}
            showEmail={profile.showEmail}
            isEditable={isEditable}
            refetchProfile={refetchProfile}
          />
        </div>

        <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
          <ProfileAvatar // Her viser vi profilbilde, kan endres hvis isEditable er true
            imageUrl={imageUrl ?? "/default-avatar.png"}
            isEditable={isEditable}
            refetchProfile={refetchProfile}
          />

          {isOwner ? (
            isEditable ? (
              <>
                <ProfileNavButton // Knapper under bilde. Disse knappene kommer hvis vi er på egen editprofil, tilbake til profil
                  href={`/profile/${profile.userId}`}
                  text="Back to Profile"
                  variant="long"
                />
                <ProfileNavButton // Til innstillinger
                  href="/profilesettings"
                  text="Settings"
                  variant="long"
                />
              </>
            ) : (
              <> 
                <ProfileNavButton // Hvis vi ikke er på editprofile, kun når vi ser på egen profil. Til editprofile
                  href="/editprofile"
                  text="Edit Profile"
                  variant="long"
                />
                <ProfileNavButton // Til innstillinger
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
                  <ProfileNavButton // Hvis vi er venner med bruker, MÅ ENDRES SENERE. SENDE MELDING
                    href="#"
                    text="Send Message"
                    variant="long"
                  />
                  <ProfileNavButton // Sende melding, spiller ingen rolle om man er venn eller ikke MÅ ENDRES SENRE SENDE MELDING
                    href="#"
                    text="Send Message"
                    variant="long"
                  />
                  <ProfileNavButton // Følge en bruker MÅ ENDRES SENERE. VED FØLGING
                    href="#"
                    text="Follow User"
                    variant="long"
                  />
                </>
              ) : (
                <>
                  <ProfileNavButton // Hvis vi ikke er venner så kan vi legge til venn her
                    href="#"
                    text="Add as Friend"
                    variant="long"
                  />
                  <ProfileNavButton // Sende melding
                    href="#"
                    text="Send Message"
                    variant="long"
                  />
                  <ProfileNavButton // Følge bruker, MÅ ENDRES SENERE. VED FØLGING
                    href="#"
                    text="Follow User"
                    variant="long"
                  />
                </>
              )} {/* Dropdownmeny med ekstra valg */}
              <ProfileActionMenu /> 
            </>
          )}
        </div>
        
      </div>
      {isOwner && !isEditable && (
          <div className="w-full">
            <h3 className="text-lg text-center font-semibold text-[#145214]">Your Friends</h3>
            <SimpleFriendList />
          </div>
        )}
    </div>
  );
}
