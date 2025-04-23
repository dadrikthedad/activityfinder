// Her har vi en gjenburkbar hook som kan brukes for å sjekke om vi er venn med brukeren vi besøker
// hooks/useFriendWith.ts
import { useEffect, useState, useCallback  } from "react";
import { useAuth } from "@/context/AuthContext";
import { isFriendWith } from "@/services/friends/isFriendWith";

export function useFriendWith(otherUserId: number) {
    const { token } = useAuth();
    const [isFriend, setIsFriend] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
  
    const checkFriendship = useCallback(async () => {
      if (!token) return;
      setLoading(true);
      try {
        const result = await isFriendWith(otherUserId, token);
        setIsFriend(result);
      } catch (error) {
        console.error("❌ Failed to fetch friendship status:", error);
        setIsFriend(false); // fallback
      } finally {
        setLoading(false);
      }
    }, [otherUserId, token]);
  
    useEffect(() => {
      checkFriendship();
    }, [checkFriendship]);
  
    return { isFriend, loading, refetchFriendship: checkFriendship };
  }
  