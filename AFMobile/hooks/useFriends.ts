// Her henter vi alle vennene våre som skal brukes i friends/page.tsx
import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { FriendDTO } from "@shared/types/FriendDTO";
import { API_ROUTES } from "@shared/constants/routes";
import { API_BASE_URL } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

interface PaginatedFriendsResponse {
  data: FriendDTO[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export function useFriends(pageSize = 30) {
  const { token } = useAuth();
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFriends = async (page: number): Promise<PaginatedFriendsResponse | null> => {
    try {
      const url = `${API_BASE_URL}${API_ROUTES.friends}?pageNumber=${page}&pageSize=${pageSize}`;
      const res = await fetchWithAuth<PaginatedFriendsResponse>(url, {}, token ?? undefined);
      return res;
    } catch (err) {
      console.error("❌ Failed to load friends:", err);
      return null;
    }
  };

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      const res = await fetchFriends(1);
      if (res) {
        setFriends(res.data);
        setTotalCount(res.totalCount);
        setPageNumber(1);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const loadMore = async () => {
    if (!token || loadingMore) return;
    const nextPage = pageNumber + 1;
    setLoadingMore(true);
    const res = await fetchFriends(nextPage);
    if (res) {
      setFriends((prev) => [...prev, ...res.data]);
      setTotalCount(res.totalCount);
      setPageNumber(nextPage);
    }
    setLoadingMore(false);
  };

  // NY: Funksjon for å fjerne en venn fra listen
  const removeFriend = useCallback((friendId: number) => {
    setFriends(prevFriends => 
      prevFriends.filter(friend => friend.friend.id !== friendId)
    );
    // Oppdater også totalCount
    setTotalCount(prevCount => Math.max(0, prevCount - 1));
  }, []);

  // NY: Funksjon for å legge til en venn (for fremtidig bruk)
  const addFriend = useCallback((newFriend: FriendDTO) => {
    setFriends(prevFriends => [newFriend, ...prevFriends]);
    setTotalCount(prevCount => prevCount + 1);
  }, []);

  // NY: Funksjon for å refresh hele listen
  const refreshFriends = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetchFriends(1);
    if (res) {
      setFriends(res.data);
      setTotalCount(res.totalCount);
      setPageNumber(1);
    }
    setLoading(false);
  }, [token, pageSize]);

  const hasMore = friends.length < totalCount;

  return { 
    friends, 
    loading, 
    loadingMore, 
    loadMore, 
    hasMore,
    removeFriend,
    addFriend,
    refreshFriends
  };
}