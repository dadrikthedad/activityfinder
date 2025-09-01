import { useEffect, useState } from "react";
import { FriendDTO } from "@shared/types/FriendDTO";
import { getFriendsOfUser } from "@/services/friends/getFriendsOfUser";
import authServiceNative from "@/services/user/authServiceNative";

export function useFriendsOfUser(userId: number) {
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const token = await authServiceNative.getAccessToken();
        if (!token) return;

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
  }, [userId]); // Fjernet token fra dependency array

  return { friends, loading };
}