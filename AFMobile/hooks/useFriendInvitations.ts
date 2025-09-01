// Her henter vi alle venneforespørselene våre som skal brukes i friends/page.tsx
"use client";

import { useEffect, useState } from "react";
import { FriendInvitationDTO } from "@shared/types/FriendInvitationDTO";
import { getFriendInvitations } from "@/services/friends/friendService";
import { useNotificationStore } from "@/store/useNotificationStore";
import authServiceNative from "@/services/user/authServiceNative";


export function useFriendInvitations(pageSize = 10) {

  const friendRequests           = useNotificationStore(s => s.friendRequests);
  const hasLoadedFriendRequests  = useNotificationStore(s => s.hasLoadedFriendRequests);
  const friendRequestTotalCount  = useNotificationStore(s => s.friendRequestTotalCount);

  const [invitations, setInvitations] = useState<FriendInvitationDTO[]>(friendRequests);
  // 1) start side-teller riktig …
  const [pageNumber, setPageNumber] = useState(
    hasLoadedFriendRequests ? 1 : 0        // ikke regn antallet inviter
  );
  const [totalCount,  setTotalCount ] = useState(
    friendRequestTotalCount ?? friendRequests.length
  );
  const [loadingMore, setLoadingMore] = useState(false);

  // 2) …og ikke nullstill den hver gang storen endrer seg
  useEffect(() => {
    setInvitations(friendRequests);
    setTotalCount(friendRequestTotalCount ?? friendRequests.length);

    // bump fra 0 → 1 kun første gang init-kallet er ferdig
    if (hasLoadedFriendRequests && pageNumber === 0) {
      setPageNumber(1);
    }
  }, [friendRequests, friendRequestTotalCount, hasLoadedFriendRequests, pageNumber ]);

  const loading = !hasLoadedFriendRequests && invitations.length === 0;

  const hasMore = invitations.length < totalCount;

  const loadMore = async () => {
    const token = await authServiceNative.getAccessToken();
    if (!token || !hasMore) return;

    setLoadingMore(true);
    const nextPage = pageNumber + 1;

    try {
      const res = await getFriendInvitations(token, nextPage, pageSize);
      setInvitations(prev => {
        const ids = new Set(prev.map(i => i.id));
        return [...prev, ...res.data.filter(i => !ids.has(i.id))];
      });
      setPageNumber(nextPage);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error("❌ Failed to load more invitations:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  return { invitations, loading, loadingMore, loadMore, hasMore };
}