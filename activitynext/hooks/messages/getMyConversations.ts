// Her henter vi samtaler med paginering
import { useState, useCallback, useEffect } from "react";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";

export function usePaginatedConversations() {
   const take = 20;
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const addConversation = useChatStore((state) => state.addConversation);
  const getConversations = useChatStore.getState; // Direktetilgang til state

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const skip = getConversations().conversations.length;
      const response = await getMyConversations(skip, take);
      const newConversations = response?.conversations || [];

      if (newConversations.length > 0) {
        newConversations.forEach(addConversation);

        if (newConversations.length < take) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, addConversation]);

  useEffect(() => {
    if (!initialized) {
      loadMore().then(() => setInitialized(true));
    }
  }, [initialized, loadMore]);

  return { loadMore, loading, hasMore };
};