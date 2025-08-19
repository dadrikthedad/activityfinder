// hooks/friends/useFriendInvitationsHandler.ts - Oppdatert versjon
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
  const setUserFriendStatus = useUserCacheStore((s) => s.setUserFriendStatus);
  const { token } = useAuth();
 
  const handleResponse = async (
    id: number,
    action: "accept" | "decline",
    options?: { removeImmediately?: boolean }
  ) => {
    if (!token) return;
    setHandlingId(id);
   
    try {
      const conversationId = await respondToInvitation(id, action, token);
     
      // Hvis accept, legg sender til som venn før vi fjerner request
      if (action === "accept") {
        const friendRequest = friendRequests.find(fr => fr.id === id);
        if (friendRequest?.userSummary) {
          setUserFriendStatus(friendRequest.userSummary.id, true);
          console.log('🤝 Added friend to user cache:', friendRequest.userSummary.fullName);
        }
      }
     
      // VIKTIG ENDRING: Fjern ALLTID fra friend requests umiddelbart
      // UI håndterer visningen av "accepted" tilstand separat
      removeFriendRequest(id);
      console.log(`🗑️ Removed friend request ${id} from store immediately`);
     
      if (action === "accept" && conversationId) {
        await finalizeConversationApproval(conversationId);
      }
      return conversationId;
    } finally {
      setHandlingId(null);
    }
  };

  // Denne funksjonen er ikke lenger nødvendig siden vi alltid fjerner umiddelbart
  const removeFriendRequestManually = (id: number) => {
    removeFriendRequest(id);
  };

  return {
    handleResponse,
    handlingId,
    removeFriendRequestManually, // Beholder for bakoverkompatibilitet
  };
}