"use client";

// Henter profil-informasjon (fra Profile.cs)
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!token) {
      return; // ikke fetch hvis token mangler
    }
  
    const fetchProfile = async () => {
      try {
        const data = await fetchWithAuth(`${API_BASE_URL}/api/profile`, {}, token);
        console.log("Fetched profile:", data); // 👈
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    fetchProfile();
  }, [token]);

  return { profile, loading, error };
}