// Her henter vi alle venneforespørselene våre som skal brukes i friends/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FriendInvitationDTO, PaginatedFriendInvResponse } from "@/types/FriendInvitationDTO";
import { getFriendInvitations } from "@/services/friends/friendService";
import { useNotificationStore } from "@/store/useNotificationStore";

export function useFriendInvitations(pageSize = 10) {
  const { token } = useAuth();
  const cachedInvitations = useNotificationStore(state => state.friendRequests);

  const [invitations, setInvitations] = useState<FriendInvitationDTO[]>(cachedInvitations ?? []);
  const [pageNumber, setPageNumber] = useState(cachedInvitations.length > 0 ? 1 : 0);
  const [totalCount, setTotalCount] = useState(cachedInvitations.length); // vi justerer når neste side hentes
  const [loading, setLoading] = useState(cachedInvitations.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const addInvitation = (invitation: FriendInvitationDTO) => {
    setInvitations((prev) => {
      if (prev.some((i) => i.id === invitation.id)) return prev;
      return [invitation, ...prev];
    });
  };

  // Kun kjøres hvis vi ikke har cached første side
  useEffect(() => {
    if (!token || cachedInvitations.length > 0) return;

    const loadInitial = async () => {
      setLoading(true);
      try {
        const response = await getFriendInvitations(token, 1, pageSize);
        setInvitations(response.data);
        setTotalCount(response.totalCount);
        setPageNumber(1);
      } catch (err) {
        console.error("❌ Failed to load friend invitations:", err);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [token]);

  const loadMore = async () => {
    if (!token) return;

    const nextPage = pageNumber + 1;
    setLoadingMore(true);

    try {
      const response: PaginatedFriendInvResponse<FriendInvitationDTO> = await getFriendInvitations(
        token,
        nextPage,
        pageSize
      );
      setInvitations(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const filtered = response.data.filter(i => !existingIds.has(i.id));
        return [...prev, ...filtered];
      });
      setPageNumber(nextPage);
      setTotalCount(response.totalCount);
    } catch (err) {
      console.error("❌ Failed to load more invitations:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = invitations.length < totalCount;

  return {
    invitations,
    loading,
    loadingMore,
    loadMore,
    hasMore,
    addInvitation,
  };
}