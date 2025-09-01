// brukes til å slette venner. Sender API til backend med delete til /friends. Brukes i /friends og på profilsiden til en bruker
import { removeFriend } from "@/services/friends/removeFriend";
import { useState } from "react";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import authServiceNative from "@/services/user/authServiceNative";

export function useRemoveFriend() {
  
    const [removing, setRemoving] = useState(false);
     const setUserFriendStatus = useUserCacheStore(state => state.setUserFriendStatus);
       
    const handleRemoveFriend = async (friendId: number, onSuccess?: () => void) => {
      const token = await authServiceNative.getAccessToken();
      if (!token) return;
  
      try {
        setRemoving(true);
        await removeFriend(friendId, token);
        setUserFriendStatus(friendId, false, false); // Not friend, not blocked
        onSuccess?.(); // Kjør callback hvis suksess
      } catch (err) {
        console.error("❌ Failed to remove friend:", err);
      } finally {
        setRemoving(false);
      }
    };
  
    return { handleRemoveFriend, removing };
  }
