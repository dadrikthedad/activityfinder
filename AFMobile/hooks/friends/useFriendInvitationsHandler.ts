// håndterer det som skjer etter en venneforespørsel er godkjent
import { useState } from "react";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuth } from "@/context/AuthContext";
import { finalizeConversationApproval } from "../messages/finalizeConversationApproval";
import { useUserCacheStore } from "@/store/useUserCacheStore";

export function useFriendRequestHandler() {
  const [handlingId, setHandlingId] = useState<number | null>(null);
  const removeFriendRequest = useNotificationStore((s) => s.removeFriendRequest);
  const friendRequests = useNotificationStore((s) => s.friendRequests);
  const setUser = useUserCacheStore((s) => s.setUser);
  
  const { token } = useAuth();

  const handleResponse = async (id: number, action: "accept" | "decline") => {
    if (!token) return;
    setHandlingId(id);
    try {
      const conversationId = await respondToInvitation(id, action, token);

       // Hvis accept, legg sender til som venn før vi fjerner request
      if (action === "accept") {
        const friendRequest = friendRequests.find(fr => fr.id === id);
        if (friendRequest?.userSummary) {
          // Legg til som venn i user cache
          setUser({
            ...friendRequest.userSummary,
            isFriend: true,     // 🎯 Sett som venn
          });
          
          console.log('🤝 Added friend to user cache:', friendRequest.userSummary.fullName);
        }
      }

      removeFriendRequest(id);

     if (action === "accept" && conversationId) {
        await finalizeConversationApproval(conversationId);
      }
    } finally {
      setHandlingId(null);
    }
  };
  

  return {
    handleResponse,
    handlingId,
  };
}



