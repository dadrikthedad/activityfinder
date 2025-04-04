"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user";
import { useAuth } from "@/context/AuthContext";
import { Profile } from "@/types/profile";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  console.log("API_BASE_URL →", API_BASE_URL);
  console.log("Token i useProfile:", token);

  const fetchProfile = useCallback(async () => {
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