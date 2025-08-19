// Denne bruker vi til å sende venneforespørsel fra en brukers side eller miniavatar, til backend FriendInvitationsController.cs
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { sendFriendInvitation } from "@/services/friendInvitations/sendFriendInvitation";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative"; // 🆕 Import toast


export function useSendFriendInvitation() {
  const { token } = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
 
  // 🆕 Legg til user cache access
  const setUser = useUserCacheStore(state => state.setUser);
  const setUserFriendStatus = useUserCacheStore(state => state.setUserFriendStatus);

  const sendInvitation = async (receiverId: number) => {
    if (!token) {
      setError("Missing authentication token.");
      return null;
    }

    try {
      setSending(true);
      setError(null);
     
      const response = await sendFriendInvitation(receiverId, token);
      setSuccessMessage(response.message);
     
      // 🎉 Håndter auto-accept
      if (response.autoAccepted && response.friendUser) {
        console.log("🤝 Auto-accepted! Adding friend to cache:", response.friendUser.fullName);
       
        // Lagre hele brukerobjektet med friend status
        setUser({
          ...response.friendUser,
          isFriend: true,
          lastUpdated: Date.now()
        });
        
        // 🆕 Spesiell toast for auto-accept
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "You're now friends! 🎉",
          customBody: `You and ${response.friendUser.fullName} are now connected. You can send messages to each other.`,
          position: 'top'
        });
        
      } else {
        // 🆕 Normal toast for pending request
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Friend request sent! 📤",
          customBody: "Your friend request has been sent successfully.",
          position: 'top'
        });
      }
     
      return response;
     
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send friend request.";
      setError(errorMessage);
      console.error("❌ Failed to send friend request:", errorMessage);
      
      // 🆕 Error toast
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Request failed ❌",
        customBody: errorMessage,
        position: 'top'
      });
      
      return null;
    } finally {
      setSending(false);
    }
  };

  return {
    sendInvitation,
    sending,
    error,
    successMessage,
  };
}