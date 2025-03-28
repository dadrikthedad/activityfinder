"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { API_BASE_URL } from "@/services/user";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types/user";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const fetchUser = async () => {
      try {
        const data = await fetchWithAuth(`${API_BASE_URL}/api/user/me`, {}, token);
        console.log("✅ Current user fetched:", data);
        setUser(data);
      } catch (err: any) {
        console.error("❌ Error fetching current user:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  return { user, loading, error };
}