// Her henter vi og håndterer profilinformasjon om den innloggede brukeren. Brukes i profilsidene, samt ProfileAvatar etc.
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user";
import { useAuth } from "@/context/AuthContext";
import { Profile } from "@shared/types/profile";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null); // Lagerer profilen
  const [loading, setLoading] = useState(true); // Viser om profilen lastst inn
  const [error, setError] = useState<string | null>(null); 
  const { token } = useAuth();

  console.log("API_BASE_URL →", API_BASE_URL); // Debug-logs
  console.log("Token i useProfile:", token);

  const fetchProfile = useCallback(async () => { // Her henter vi profile fra API. Callback for å forsikre oss om at den ikke kjører flere ganger uten bekreftelse
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
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}