// Denne bruker vi til å sende venneforespørsel fra en brukers side eller miniavatar, til backend FriendInvitationsController.cs
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { sendFriendInvitation } from "@/services/friendInvitations/sendFriendInvitation";

export function useSendFriendInvitation() {
  const { token } = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sendInvitation = async (receiverId: number) => {
    if (!token) {
      setError("Missing authentication token.");
      return;
    }

    try {
      setSending(true);
      setError(null);
      const message = await sendFriendInvitation(receiverId, token);
      setSuccessMessage(message);
    } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send friend request.";
        setError(errorMessage);
        console.error("❌ Failed to send friend request:", errorMessage);
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
