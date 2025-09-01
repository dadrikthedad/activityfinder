// hooks/friends/useFriendInvitationsHandler.ts - Oppdatert versjon
import { useState } from "react";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuth } from "@/context/AuthContext";
import { finalizeConversationApproval } from "../messages/finalizeConversationApproval";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import authServiceNative from "@/services/user/authServiceNative";

export function useFriendRequestHandlerNative() {
  const [handlingId, setHandlingId] = useState<number | null>(null);
  const removeFriendRequest = useNotificationStore((s) => s.removeFriendRequest);
  const friendRequests = useNotificationStore((s) => s.friendRequests);
  const setUserFriendStatus = useUserCacheStore((s) => s.setUserFriendStatus);
  const setUser = useUserCacheStore((s) => s.setUser);
 
  const handleResponse = async (
    id: number,
    action: "accept" | "decline",
    options?: { 
      removeImmediately?: boolean,
      // 🆕 For rejected invitations som ikke finnes i notification store
      userSummary?: {
        id: number;
        fullName: string;
        profileImageUrl?: string | null;
      }
    }
  ) => {
    const token = await authServiceNative.getAccessToken();
    if (!token) return;
    setHandlingId(id);
   
    try {
      const conversationId = await respondToInvitation(id, action, token);
     
      // Hvis accept, legg sender til som venn før vi fjerner request
      if (action === "accept") {
        // 🆕 Prøv først å finne i pending requests
        let friendRequest = friendRequests.find(fr => fr.id === id);
        
        // 🆕 Hvis ikke funnet og userSummary er oppgitt (rejected invitation)
        if (!friendRequest && options?.userSummary) {
          friendRequest = {
            id,
            userSummary: {
              id: options.userSummary.id,
              fullName: options.userSummary.fullName,
              profileImageUrl: options.userSummary.profileImageUrl || null
            }
          } as any; // Type assertion siden vi bare trenger userSummary
        }
        
        if (friendRequest?.userSummary) {
          console.log(`useFriendRequestHandlerNative Processing friend acceptance for ${friendRequest.userSummary.fullName} (ID: ${friendRequest.userSummary.id})`);
          
          // 🔧 Bruk setUser for å oppdatere/legge til bruker med friend status
          setUser({
            id: friendRequest.userSummary.id,
            fullName: friendRequest.userSummary.fullName,
            profileImageUrl: friendRequest.userSummary.profileImageUrl,
            isFriend: true
          });
          
          console.log('useFriendRequestHandlerNative Updated user cache with friend status:', friendRequest.userSummary.fullName);
        } else {
          console.warn('useFriendRequestHandlerNative No userSummary found for friend request', id);
        }
      }
     
      // Fjern fra notification store hvis den finnes der
      if (friendRequests.find(fr => fr.id === id)) {
        removeFriendRequest(id);
        console.log(`useFriendRequestHandlerNative Removed friend request ${id} from notification store`);
      }
     
      if (action === "accept" && conversationId) {
        await finalizeConversationApproval(conversationId);
      }
      
      return conversationId;
    } finally {
      setHandlingId(null);
    }
  };

  const removeFriendRequestManually = (id: number) => {
    removeFriendRequest(id);
  };

  return {
    handleResponse,
    handlingId,
    removeFriendRequestManually,
  };
}