"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user";

export interface UserProfileSettingsDTO {
  firstName?: string;
  middleName: string;
  lastName?: string;
  phone?: string;
  country: string;
  region?: string;
  postalCode?: string;
  gender?: string;
}

export function useUserSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<UserProfileSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchSettings = async () => {
      const url = `${API_BASE_URL}/api/user/me/settings`;
      console.log("🔄 Henter brukerinnstillinger fra:", url);
      console.log("🔐 Bruker token:", token?.slice(0, 20) + "...");

      try {
        const data = await fetchWithAuth<UserProfileSettingsDTO>(
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