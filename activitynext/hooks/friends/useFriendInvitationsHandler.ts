import { useState } from "react";
import { respondToInvitation } from "@/services/friendInvitations/respondToInvitation";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuth } from "@/context/AuthContext";
import { finalizeConversationApproval } from "../messages/finalizeConversationApproval";

export function useFriendRequestHandler() {
  const [handlingId, setHandlingId] = useState<number | null>(null);
  const removeFriendRequest = useNotificationStore((s) => s.removeFriendRequest);
  const { token } = useAuth();

  const handleResponse = async (id: number, action: "accept" | "decline") => {
    if (!token) return;
    setHandlingId(id);
    try {
      const conversationId = await respondToInvitation(id, action, token);
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



