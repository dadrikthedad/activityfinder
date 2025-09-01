// Her henter vi og håndterer profilinformasjon om den innloggede brukeren. Brukes i profilsidene, samt ProfileAvatar etc.
import { useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "@/constants/routes";
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { Profile } from "@shared/types/profile";
import authServiceNative from "@/services/user/authServiceNative";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null); // Lagerer profilen
  const [loading, setLoading] = useState(true); // Viser om profilen lastst inn
  const [error, setError] = useState<string | null>(null); 

  console.log("API_BASE_URL →", API_BASE_URL); // Debug-logs

  const fetchProfile = useCallback(async () => { // Her henter vi profile fra API. Callback for å forsikre oss om at den ikke kjører flere ganger uten bekreftelse
    const token = await authServiceNative.getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const data = await fetchWithAuth<Profile>(`${API_BASE_URL}/api/profile`, {}, token);
      console.log("Fetched profile:", data);
      setProfile(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ukjent feil oppsto.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}