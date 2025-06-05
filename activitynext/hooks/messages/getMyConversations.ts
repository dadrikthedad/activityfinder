// Her henter vi samtaler med paginering
import { useState, useCallback, useEffect } from "react";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";

export const take = 20;
export function usePaginatedConversations() {

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const conversations = useChatStore((state) => state.conversations);
  const hasLoaded = useChatStore((s) => s.hasLoadedConversations);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const skip = useChatStore.getState().conversations.length;
    console.log("🔄 loadMore() called. Skip:", skip, "Take:", take);

    try {
      const response = await getMyConversations(skip, take);
      const newConversations = response?.conversations || [];

      console.log("📬 load - Got conversations:", newConversations.length);

      newConversations.forEach(useChatStore.getState().addConversation);

      // Justér hasMore basert på resultat
      if (newConversations.length < take) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("❌ Feil ved henting av samtaler:", err);
      setHasMore(false); // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Når init-data er lastet: bestem om det finnes mer
  useEffect(() => {
    if (!hasLoaded) return;

    const remainder = conversations.length % take;
    const shouldFetchMore = conversations.length > 0 && remainder === 0;

    setHasMore(shouldFetchMore);
  }, [hasLoaded, conversations.length]);

  return {
    loadMore,
    loading,
    hasMore,
  };
}