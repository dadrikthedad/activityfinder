// Her henter vi alle venneforespørselene våre som skal brukes i friends/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FriendInvitationDTO } from "@/types/FriendInvitationDTO";
import { getFriendInvitations } from "@/services/friends/friendService";

export function useFriendInvitations() {
  const { token } = useAuth();
  const [invitations, setInvitations] = useState<FriendInvitationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const data = await getFriendInvitations(token);
        console.log("📨 Fetched invitations:", data);
        setInvitations(data);
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