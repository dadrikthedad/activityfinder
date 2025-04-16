// Her henter vi alle venneforespørselene våre som skal brukes i friends/page.tsx
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";
import { FriendInvitationDTO } from "@/types/FriendInvitationDTO";

export function useFriendInvitations() {
  const [invitations, setInvitations] = useState<FriendInvitationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWithAuth<FriendInvitationDTO[]>(
          "/api/friendinvitations/received"
        );
        if (data) setInvitations(data);
      } catch (err) {
        console.error("❌ Failed to load invitations:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { invitations, loading };
}