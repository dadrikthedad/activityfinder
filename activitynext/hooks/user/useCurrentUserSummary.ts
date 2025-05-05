"use client"
import { useEffect, useState } from "react";
import { getCurrentUserSummary } from "@/services/user/getCurrentUserSummary";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

export function useCurrentUserSummary() {
  const [user, setUser] = useState<UserSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🔍 useCurrentUserSummary: henter bruker...");
    getCurrentUserSummary()
      .then((data) => {
        console.log("✅ Bruker hentet:", data);
        setUser(data);
      })
      .catch((err) => {
        console.error("❌ Feil ved henting av bruker:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, error };
}