// Henter API-en GetPublicProfile() fra Backend. Bruker PublicProfileDTO både i frontend og backend

"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";


export function useUserSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    console.log("🌍 API_BASE_URL:", API_BASE_URL);

    const fetchSettings = async () => {
      const url = `${API_BASE_URL}/api/user/profilesettings`;
      console.log("🔄 Henter brukerinnstillinger fra:", url);
      console.log("🔐 Bruker token:", token?.slice(0, 20) + "...");

      console.log("🔍 Tester fetch fra:", url);

      try {
        const data = await fetchWithAuth<PublicProfileDTO>(
          url,
          {},
          token
        );

        console.log("✅ Data fra backend (user settings):", data);
        setSettings(data);
      } catch (err) {
        console.error("❌ Klarte ikke hente brukerinnstillinger:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [token]);

  return { settings, loading, error };
}