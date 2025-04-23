import { useEffect, useState } from "react";
import { FriendDTO } from "@/types/FriendDTO";
import { useAuth } from "@/context/AuthContext";
import { getFriendsOfUser } from "@/services/friends/getFriendsOfUser";

export function useFriendsOfUser(userId: number) {
  const { token } = useAuth();
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;

    const load = async () => {
      try {
        const data = await getFriendsOfUser(userId, token);
        console.log("🟢 Friends fetched from backend:", data);
        if (data) setFriends(data);
      } catch (err) {
        console.error("❌ Failed to load user's friends:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, token]);

  return { friends, loading };
}