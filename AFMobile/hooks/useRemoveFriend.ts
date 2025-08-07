// brukes til å slette venner. Sender API til backend med delete til /friends. Brukes i /friends og på profilsiden til en bruker
import { useAuth } from "@/context/AuthContext";
import { removeFriend } from "@/services/friends/removeFriend";
import { useState } from "react";

export function useRemoveFriend() {
    const { token } = useAuth();
    const [removing, setRemoving] = useState(false);
  
    const handleRemoveFriend = async (friendId: number, onSuccess?: () => void) => {
      if (!token) return;
  
      try {
        setRemoving(true);
        await removeFriend(friendId, token);
        onSuccess?.(); // Kjør callback hvis suksess
      } catch (err) {
        console.error("❌ Failed to remove friend:", err);
      } finally {
        setRemoving(false);
      }
    };
  
    return { handleRemoveFriend, removing };
  }
