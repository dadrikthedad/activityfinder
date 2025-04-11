"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/services/profile";
import PublicProfileView from "@/components/profile/PublicProfileView";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";
import AdditionalSettings from "@/components/settings/AdditionalSettings";
import { useUpdateUserSettings } from "@/hooks/useUpdateUserSettings";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";

export default function EditProfilePage() {
  const { updateSettings } = useUpdateUserSettings();

  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      // Henter token
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Missing token");
      
      // Henter userId fra token
      const userId = getUserIdFromToken(token);
      if (!userId) throw new Error("Missing userId in token");
  
      console.log("🔑 Fetching profile for userId:", userId);
      // Henter profilen til brukeren med API-kall, vi gir den hvem bruker og autorisation med token
      const data = await getUserProfile(userId, token, { cache: "no-store" });
      setProfile(data);
    } catch (err) {
      console.error("❌ Error fetching profile:", err);
    }
  };

  // Reloader siden når vi sender til backend
  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, []);

  if (loading || !profile) {
    return <div className="text-center mt-10">Loading profile...</div>;
  }


  return (
    <div className="flex flex-col gap-20 max-w-4xl mx-auto px-4 py-10 min-h-[85vh]">
      <div className="flex-grow">
        <PublicProfileView profile={profile} isEditable={true} isOwner={true} />
      </div>
  
      <div className="mt-8">
        <AdditionalSettings // Her er alle delene vi skal hente ut fra AdditionalSettings, vi trenger ikke alle
          initialValues={{
            showGender: profile.showGender,
            showEmail: profile.showEmail,
            showPhone: profile.showPhone,
            showRegion: profile.showRegion,
            showPostalCode: profile.showPostalCode,
            showStats: profile.showStats,
            showWebsites: profile.showWebsites,
            showAge: profile.showAge,
            showBirthday: profile.showBirthday
          }}
          onSave={async (updated) => {
            setLoading(true);
            await updateSettings(updated);
            await fetchProfile();
            setLoading(false);
          }}
        />
      </div>
    </div>
  );
}
