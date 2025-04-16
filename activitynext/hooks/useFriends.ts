// Her henter vi alle vennene våre som skal brukes i friends/page.tsx
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { FriendDTO } from "@/types/FriendDTO";
import { API_ROUTES, API_BASE_URL } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

export function useFriends() {
  const { token } = useAuth();
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
        try {
            const data = await fetchWithAuth<FriendDTO[]>(
              `${API_BASE_URL}${API_ROUTES.friends}`,
              {},
              token
            );
        if (data) setFriends(data);
      } catch (err) {
        console.error("❌ Failed to load friends:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  return { friends, loading };
}