// Her har vi en gjenburkbar hook som kan brukes for å sjekke om vi er venn med brukeren vi besøker
// hooks/useFriendWith.ts
import { useState, useCallback  } from "react";
import { useAuth } from "@/context/AuthContext";
import { isFriendWith } from "@/services/friends/isFriendWith";

export function useFriendWith() {
  const { token } = useAuth();
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const checkFriendship = useCallback(
    async (otherUserId: number) => {
      if (!token) return;
      setLoading(true);
      try {
        const result = await isFriendWith(otherUserId, token);
        setIsFriend(result);
      } catch (error) {
        console.error("❌ Failed to fetch friendship status:", error);
        setIsFriend(false);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return { isFriend, loading, checkFriendship };
}
  