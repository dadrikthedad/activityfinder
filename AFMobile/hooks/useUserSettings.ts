import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/constants/routes";
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { PublicProfileDTO } from "@shared/types/PublicProfileDTO";
import authServiceNative from "@/services/user/authServiceNative";

export function useUserSettings(refreshIndex: number = 0) {
  const { userId } = useAuth(); // Hent userId direkte fra AuthContext
  const [settings, setSettings] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      console.warn("🚫 Ingen bruker-ID funnet i AuthContext");
      return;
    }

    const fetchSettings = async () => {
      setLoading(true);
      try {
        // Hent fresh token
        const token = await authServiceNative.getAccessToken();
        if (!token) {
          throw new Error("No authentication token available");
        }

        const url = `${API_BASE_URL}/api/profile/${userId}`;
        console.log("🔄 Henter brukerinnstillinger fra:", url);
        console.log("👤 Bruker-ID:", userId);

        const data = await fetchWithAuth<PublicProfileDTO>(
          url,
          {},
          token
        );

        if (!data) {
          throw new Error("Tomt svar fra API.");
        }

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
  }, [userId, refreshIndex]); // userId i stedet for token

  return { settings, loading, error };
}