// Her henter vi alle vennene våre som skal brukes i friends/page.tsx
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { FriendDTO } from "@/types/FriendDTO";

export function useFriends() {
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWithAuth<FriendDTO[]>("/api/friends");
        if (data) setFriends(data);
      } catch (err) {
        console.error("❌ Failed to load friends:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { friends, loading };
}