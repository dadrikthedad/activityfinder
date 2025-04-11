// Henter API-en GetPublicProfile() fra Backend. Bruker PublicProfileDTO både i frontend og backend

"use client";
// Brukes for å 
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";

// Bruker refreshIndex for å resette siden etter endring
export function useUserSettings(refreshIndex: number = 0) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      console.warn("🚫 Ingen token funnet i AuthContext");
      return;
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
      console.warn("❌ Fant ikke bruker-ID i token");
      return;
    }
    
    const url = `${API_BASE_URL}/api/profile/${userId}`;
    console.log("🔄 Henter brukerinnstillinger fra:", url);
    console.log("👤 Bruker-ID:", userId);
    console.log("🔐 Token (1st 20 chars):", token.slice(0, 20) + "...");

    const fetchSettings = async () => {
      setLoading(true);

      try {
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
  }, [token, refreshIndex]);

  return { settings, loading, error };
}