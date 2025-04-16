// Her henter vi alle venneforespørselene våre som skal brukes i friends/page.tsx
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { FriendInvitationDTO } from "@/types/FriendInvitationDTO";
import { API_ROUTES, API_BASE_URL } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

export function useFriendInvitations() {
  const { token } = useAuth();
  const [invitations, setInvitations] = useState<FriendInvitationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const data = await fetchWithAuth<FriendInvitationDTO[]>(
          `${API_BASE_URL}${API_ROUTES.friendInvitations.received}`,
          {},
          token
        );

        console.log("📨 Fetched invitations:", data);
        if (data) setInvitations(data);
      } catch (err) {
        console.error("❌ Failed to load invitations:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  return { invitations, loading };
}